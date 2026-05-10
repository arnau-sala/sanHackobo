import { useEffect, useMemo, useRef, useState } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import type { CopilotResponse } from "@damm/copilot";
import { askCopilot } from "../lib/copilotClient";
import { VoicePoweredOrb } from "../components/ui/voice-powered-orb";
import styles from "./Dashboard.module.css";

type HandsfreeState = "idle" | "listening" | "thinking" | "speaking";

interface CopilotChatProps {
  className?: string;
  currentStopId: string;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  inputData: InputData;
  onAction?: (action: CopilotResponse["actions"][number]) => void;
}

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      runIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!handsfreeOn) {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      setState("idle");
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      alert("Tu navegador no soporta SpeechRecognition (usa Chrome o Edge).");
      setHandsfreeOn(false);
      return;
    }
    const SpeechRec = SR;

    runIdRef.current += 1;
    const runId = runIdRef.current;

    async function listenOnce(): Promise<string | null> {
      return await new Promise((resolve) => {
        let finished = false;
        const finish = (value: string | null) => {
          if (finished) return;
          finished = true;
          resolve(value);
        };

        const rec = new SpeechRec();
        recognitionRef.current = rec;
        rec.lang = "es-ES";
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (event: SpeechRecognitionEvent) => {
          finish((event.results[0]?.[0]?.transcript ?? "").trim() || null);
        };
        rec.onerror = () => finish(null);
        rec.onend = () => finish(null);

        setState("listening");
        rec.start();
      });
    }

    async function playAudio(base64: string, mimeType: string): Promise<void> {
      await new Promise((resolve) => {
        const audio = new Audio(`data:${mimeType};base64,${base64}`);
        audioRef.current = audio;
        audio.onended = () => resolve(undefined);
        audio.onerror = () => resolve(undefined);
        void audio.play().catch(() => resolve(undefined));
      });
    }

    async function runHandsfreeLoop() {
      while (handsfreeOn && runIdRef.current === runId) {
        const heard = await listenOnce();
        if (!handsfreeOn || runIdRef.current !== runId) return;
        if (!heard) continue;

        setState("thinking");
        try {
          const result = await askCopilot(
            {
              currentStopId,
              question: heard,
              routePlan,
              loadPlan,
              inputData,
            },
            { withVoice: true },
          );

          result.response.actions?.forEach((a) => onAction?.(a));

          if (result.ttsAudioBase64 && result.ttsMimeType) {
            setState("speaking");
            await playAudio(result.ttsAudioBase64, result.ttsMimeType);
          }
        } catch {
          // Ignora fallos puntuales para mantener el flujo manos libres.
        }
      }
    }

    void runHandsfreeLoop();
  }, [handsfreeOn, currentStopId, routePlan, loadPlan, inputData, onAction]);

  function toggleHandsfree() {
    if (handsfreeOn) {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      runIdRef.current += 1;
      setHandsfreeOn(false);
      setState("idle");
      return;
    }
    setHandsfreeOn(true);
  }

  const title = useMemo(() => {
    if (!handsfreeOn) return "Iniciar manos libres";
    if (state === "listening") return "Escuchando";
    if (state === "thinking") return "Procesando";
    if (state === "speaking") return "Respondiendo";
    return "Detener manos libres";
  }, [handsfreeOn, state]);

  const orbIntensity = useMemo(() => {
    if (!handsfreeOn) return 0;
    if (state === "listening") return 0.9;
    if (state === "thinking") return 0.55;
    if (state === "speaking") return 1;
    return 0.4;
  }, [handsfreeOn, state]);

  return (
    <div
      className={[styles.handsfreePanel, className].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      onClick={toggleHandsfree}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleHandsfree();
        }
      }}
      title={title}
      aria-label={title}
      aria-pressed={handsfreeOn}
    >
      <div
        className={styles.handsfreeOrbWrap}
        data-active={handsfreeOn ? "true" : "false"}
      >
        <VoicePoweredOrb
          className={styles.handsfreeOrb}
          hue={-10}
          active={handsfreeOn}
          intensity={orbIntensity}
        />
      </div>
      <p className={styles.handsfreeHint}>Toca para hablar</p>
    </div>
  );
}
