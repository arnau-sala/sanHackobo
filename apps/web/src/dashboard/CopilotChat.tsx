import { useEffect, useMemo, useRef, useState } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import type { CopilotResponse } from "@damm/copilot";
import { VoicePoweredOrb } from "../components/ui/voice-powered-orb";
import styles from "./Dashboard.module.css";

type HandsfreeState = "idle" | "listening" | "thinking" | "speaking";
type MicPermission = "unknown" | "granted" | "denied" | "prompt";

interface CopilotChatProps {
  className?: string;
  currentStopId: string;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  inputData: InputData;
  onAction?: (action: CopilotResponse["actions"][number]) => void;
}

const SILENCE_RMS = 0.010;
const SILENCE_END_MS = 1200;
const VOICE_START_MS = 120;
const MAX_TURN_MS = 10000;
const MIN_TURN_MS = 600;

export function CopilotChat({
  className,
  currentStopId,
  routePlan,
  loadPlan,
  inputData,
  onAction,
}: CopilotChatProps) {
  const [handsfreeOn, setHandsfreeOn] = useState(false);
  const [state, setState] = useState<HandsfreeState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [micPerm, setMicPerm] = useState<MicPermission>("unknown");

  const audioElRef  = useRef<HTMLAudioElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const acRef       = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopFlagRef = useRef(false);

  const propsRef = useRef({ currentStopId, routePlan, loadPlan, inputData, onAction });
  useEffect(() => {
    propsRef.current = { currentStopId, routePlan, loadPlan, inputData, onAction };
  }, [currentStopId, routePlan, loadPlan, inputData, onAction]);

  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        setMicPerm(status.state as MicPermission);
        status.onchange = () => setMicPerm(status.state as MicPermission);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function teardown() {
    stopFlagRef.current = true;
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { void acRef.current?.close(); } catch {}
    acRef.current = null;
    audioElRef.current?.pause();
    audioElRef.current = null;
  }

  async function ensureMic(): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Tu navegador no expone el microfono.");
      return null;
    }
    try {
      // Primero intentamos con constraints completas
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setErrorMsg(null);
      setMicPerm("granted");
      return stream;
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? "";

      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicPerm("denied");
        setErrorMsg("Bloqueado");
        return null;
      }

      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        // Chrome no enumera dispositivos hasta tener permiso concedido.
        // Reintentamos con audio:true básico para forzar el prompt del sistema.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setErrorMsg(null);
          setMicPerm("granted");
          return stream;
        } catch (e2: unknown) {
          const name2 = (e2 as { name?: string })?.name ?? "";
          if (name2 === "NotAllowedError" || name2 === "SecurityError") {
            setMicPerm("denied");
            setErrorMsg("Bloqueado");
          } else if (name2 === "NotFoundError" || name2 === "DevicesNotFoundError") {
            setErrorMsg("No se detecta microfono. Conecta uno y reintenta.");
          } else {
            setErrorMsg("No se pudo acceder al microfono. Recarga la pagina.");
          }
          return null;
        }
      }

      if (name === "NotReadableError" || name === "TrackStartError") {
        setErrorMsg("El microfono lo usa otra app. Cierrala y reintenta.");
      } else {
        setErrorMsg(`Error de microfono (${name || "desconocido"}). Recarga la pagina.`);
      }
      return null;
    }
  }

  function pickMime(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return "audio/webm";
  }

  async function captureTurn(stream: MediaStream): Promise<{ blob: Blob; mime: string } | null> {
    const ac = acRef.current!;
    const source = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const mime = pickMime();
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    setState("listening");
    let armed = false;
    let voiceMs = 0;
    let silenceMs = 0;
    let turnMs = 0;
    let recordingStartedAt = 0;
    const FRAME = 50;

    function rms(): number {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.sqrt(sum / buf.length);
    }

    return await new Promise((resolve) => {
      recorder.onstop = () => {
        if (chunks.length === 0) { resolve(null); return; }
        const blob = new Blob(chunks, { type: mime });
        resolve({ blob, mime });
      };

      const tick = () => {
        if (stopFlagRef.current) {
          if (recorder.state !== "inactive") recorder.stop();
          else resolve(null);
          return;
        }
        const level = rms();
        const isVoice = level > SILENCE_RMS;

        if (!armed) {
          if (isVoice) {
            voiceMs += FRAME;
            if (voiceMs >= VOICE_START_MS) {
              armed = true;
              recordingStartedAt = performance.now();
              try { recorder.start(250); } catch { resolve(null); return; }
            }
          } else {
            voiceMs = 0;
          }
        } else {
          turnMs = performance.now() - recordingStartedAt;
          if (isVoice) {
            silenceMs = 0;
          } else {
            silenceMs += FRAME;
          }
          const longEnough = turnMs >= MIN_TURN_MS;
          if (longEnough && silenceMs >= SILENCE_END_MS) {
            try { recorder.stop(); } catch { resolve(null); }
            return;
          }
          if (turnMs >= MAX_TURN_MS) {
            try { recorder.stop(); } catch { resolve(null); }
            return;
          }
        }
        setTimeout(tick, FRAME);
      };
      tick();
    });
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
    }
    return btoa(bin);
  }

  async function queryByText(question: string) {
    const p = propsRef.current;
    const res = await fetch("/api/voice/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentStopId: p.currentStopId,
        question,
        routePlan: p.routePlan,
        loadPlan: p.loadPlan,
        inputData: p.inputData,
      }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ response: CopilotResponse; tts?: { audioBase64: string; mimeType: string } }>;
  }

  async function processTurn(audio: { blob: Blob; mime: string }) {
    setState("thinking");
    try {
      const audioBase64 = await blobToBase64(audio.blob);
      const p = propsRef.current;
      const res = await fetch("/api/voice/handsfree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStopId: p.currentStopId,
          audioBase64,
          audioMimeType: audio.mime,
          languageCode: "spa",
          routePlan: p.routePlan,
          loadPlan: p.loadPlan,
          inputData: p.inputData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.transcript) setLastHeard(String(data.transcript));
        data?.response?.actions?.forEach((a: CopilotResponse["actions"][number]) => p.onAction?.(a));
        const tts = data?.tts;
        if (tts?.audioBase64 && tts?.mimeType) {
          await playAudio(tts.audioBase64, tts.mimeType);
        } else if (data?.response?.answer) {
          await speakBrowser(data.response.answer);
        }
        return;
      }

      // STT falló — intentamos reproducir algo igual para que el asistente no quede mudo
      const txt = await res.text();
      console.warn("[voice] /handsfree error", res.status, txt);

      // Fallback: pregunta genérica por texto para al menos dar respuesta hablada
      const fallback = await queryByText("Dame un resumen de mi siguiente parada");
      if (fallback?.tts?.audioBase64 && fallback?.tts?.mimeType) {
        await playAudio(fallback.tts.audioBase64, fallback.tts.mimeType);
      } else if (fallback?.response?.answer) {
        await speakBrowser(fallback.response.answer);
      } else {
        await speakBrowser("No he podido entenderte bien. Intenta hablar de nuevo.");
      }

    } catch (e: unknown) {
      console.warn("[voice] processTurn error", e);
      await speakBrowser("Ha ocurrido un error. Inténtalo de nuevo.");
    }
  }

  function playAudio(base64: string, mime: string): Promise<void> {
    return new Promise(async (resolve) => {
      setState("speaking");
      try {
        // Decodifica base64 a ArrayBuffer y reproduce via AudioContext
        // para evitar el bloqueo de autoplay de Chrome con new Audio().
        const ac = acRef.current!;
        if (ac.state === "suspended") await ac.resume();

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const audioBuffer = await ac.decodeAudioData(bytes.buffer);
        const source = ac.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ac.destination);
        source.onended = () => resolve();
        source.start(0);
      } catch (err) {
        console.warn("[voice] playAudio error, fallback a <audio>", err);
        // Fallback a elemento Audio si AudioContext falla
        const audio = new Audio(`data:${mime};base64,${base64}`);
        audioElRef.current = audio;
        const done = () => resolve();
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      }
    });
  }

  function speakBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "es-ES";
        utt.rate = 1.05;
        utt.onend = () => resolve();
        utt.onerror = () => resolve();
        setState("speaking");
        window.speechSynthesis.speak(utt);
      } catch { resolve(); }
    });
  }

  async function startSession() {
    const stream = await ensureMic();
    if (!stream) { setHandsfreeOn(false); return; }
    streamRef.current = stream;
    const Ctor = (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
    acRef.current = new Ctor();
    if (acRef.current!.state === "suspended") {
      try { await acRef.current!.resume(); } catch {}
    }
    stopFlagRef.current = false;

    while (!stopFlagRef.current) {
      const turn = await captureTurn(stream);
      if (stopFlagRef.current) break;
      if (turn) await processTurn(turn);
    }
    teardown();
    setState("idle");
  }

  async function toggleHandsfree() {
    if (handsfreeOn) {
      stopFlagRef.current = true;
      try { recorderRef.current?.stop(); } catch {}
      audioElRef.current?.pause();
      window.speechSynthesis?.cancel?.();
      setHandsfreeOn(false);
      setState("idle");
      return;
    }
    setHandsfreeOn(true);
    void startSession();
  }

  const orbIntensity = useMemo(() => {
    if (!handsfreeOn) return 0;
    if (state === "listening") return 0.9;
    if (state === "thinking")  return 0.55;
    if (state === "speaking")  return 1;
    return 0.4;
  }, [handsfreeOn, state]);

  const title = useMemo(() => {
    if (!handsfreeOn) return "Iniciar manos libres";
    if (state === "listening") return "Escuchando";
    if (state === "thinking")  return "Procesando";
    if (state === "speaking")  return "Respondiendo";
    return "Detener manos libres";
  }, [handsfreeOn, state]);

  const isBlocked = micPerm === "denied" || errorMsg === "Bloqueado";

  if (isBlocked) {
    return (
      <div className={[styles.handsfreePanel, className].filter(Boolean).join(" ")}
        style={{ cursor: "default" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 12px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b00500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#b00500", textAlign: "center" }}>
            Microfono bloqueado
          </p>
          <div style={{
            background: "rgba(176,5,0,.07)", border: "1px solid rgba(176,5,0,.2)",
            borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "#0f1115",
            lineHeight: 1.5, textAlign: "left", maxWidth: 200,
          }}>
            <p style={{ margin: "0 0 5px", fontWeight: 700 }}>Para desbloquear:</p>
            <ol style={{ margin: 0, paddingLeft: 16 }}>
              <li>Haz clic en el <strong>icono mic</strong> en la barra URL</li>
              <li>Selecciona <strong>Microfono &rarr; Permitir</strong></li>
              <li>Pulsa <strong>Listo</strong></li>
            </ol>
          </div>
          <button
            style={{
              marginTop: 4, fontSize: 10, padding: "5px 14px",
              background: "#e10600", color: "#fff", border: "none",
              borderRadius: 6, cursor: "pointer", fontWeight: 600,
            }}
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[styles.handsfreePanel, className].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => { void toggleHandsfree(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void toggleHandsfree();
        }
      }}
      title={title}
      aria-label={title}
      aria-pressed={handsfreeOn}
    >
      <div className={styles.handsfreeOrbWrap} data-active={handsfreeOn ? "true" : "false"}>
        <VoicePoweredOrb
          className={styles.handsfreeOrb}
          hue={-10}
          active={handsfreeOn}
          intensity={orbIntensity}
        />
      </div>
      <p className={styles.handsfreeHint}>
        {!handsfreeOn ? "Toca para hablar"
          : state === "listening" ? "Escuchando..."
          : state === "thinking"  ? "Procesando..."
          : state === "speaking"  ? "Respondiendo"
          : "Toca para parar"}
      </p>
      {lastHeard && handsfreeOn && (
        <p style={{
          margin: "2px 14px 0", fontSize: 9.5, color: "var(--t3,#6b7280)",
          fontStyle: "italic", textAlign: "center", lineHeight: 1.3,
          maxWidth: "85%", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          &quot;{lastHeard}&quot;
        </p>
      )}
      {errorMsg && !isBlocked && (
        <div style={{ margin: "4px 10px 0", textAlign: "center" }}>
          <p style={{ margin: "0 0 5px", fontSize: 9.5, color: "#b00500", lineHeight: 1.3, fontWeight: 700 }}>
            {errorMsg}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); setErrorMsg(null); setHandsfreeOn(false); }}
            style={{
              fontSize: 9.5, padding: "3px 10px", borderRadius: 5,
              background: "#e10600", color: "#fff", border: "none",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
