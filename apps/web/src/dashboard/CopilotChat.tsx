/**
 * Chat con el copiloto del conductor.
 *
 *   - Texto: usa POST /api/copilot (con fallback al motor in-browser).
 *   - Voz salida: POST /api/voice/query devuelve audio TTS de ElevenLabs.
 *   - Voz entrada: SpeechRecognition del navegador (Chrome/Edge).
 *
 * Sample questions estan disenadas para activar cada categoria del motor:
 *   - "donde / descargar / mercancia" -> `answerUnloadQuestion`
 *   - "por que / primero"             -> `answerReasoningQuestion`
 *   - "retornable / recoger"          -> `answerReturnablesQuestion`
 *   - "cambio + numeros"              -> `answerSwapQuestion`
 */
import { useEffect, useRef, useState } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import type { CopilotResponse } from "@damm/copilot";
import { askCopilot } from "../lib/copilotClient";
import styles from "./Dashboard.module.css";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  source?: "api" | "local";
  actions?: CopilotResponse["actions"];
};

interface CopilotChatProps {
  currentStopId: string;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  inputData: InputData;
  onAction?: (action: CopilotResponse["actions"][number]) => void;
}

const SAMPLE_QUESTIONS = [
  "Donde tengo que descargar?",
  "Por que vamos primero aqui?",
  "Que retornables recogemos?",
  "Cambio la parada 4 por la 9?",
];

export function CopilotChat({
  currentStopId,
  routePlan,
  loadPlan,
  inputData,
  onAction,
}: CopilotChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "bot",
      text:
        "Hola, soy el copiloto. Pregunta por la descarga, la ruta, retornables o " +
        "simulaciones. Selecciona una parada en la izquierda para que las " +
        "respuestas tengan contexto.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setText("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
    ]);

    try {
      const result = await askCopilot(
        {
          currentStopId,
          question: trimmed,
          routePlan,
          loadPlan,
          inputData,
        },
        { withVoice: voiceOn },
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: result.response.answer,
          source: result.source,
          actions: result.response.actions,
        },
      ]);
      result.response.actions?.forEach((a) => onAction?.(a));

      if (result.ttsAudioBase64 && result.ttsMimeType) {
        const audio = new Audio(
          `data:${result.ttsMimeType};base64,${result.ttsAudioBase64}`,
        );
        audioRef.current = audio;
        await audio.play().catch(() => undefined);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "bot",
          text: `Fallo al consultar al copiloto: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const SR =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      alert("Tu navegador no soporta SpeechRecognition (usa Chrome o Edge).");
      return;
    }
    const rec = new SR();
    rec.lang = "es-ES";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) void send(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>Copiloto IA</h3>
        <span>{voiceOn ? "voz: ON" : "voz: OFF"}</span>
      </div>

      <div className={styles.chatBody} ref={bodyRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bubble} ${
              m.role === "user" ? styles.bubbleUser : styles.bubbleBot
            }`}
          >
            {m.text}
            {m.role === "bot" && m.source && (
              <div className={styles.bubbleMeta}>
                fuente: {m.source === "api" ? "/api/copilot" : "in-browser"}
              </div>
            )}
            {m.actions && m.actions.length > 0 && (
              <div className={styles.bubbleActions}>
                {m.actions.map((a, i) => (
                  <span key={i} className={styles.actionChip}>
                    {actionLabel(a)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className={`${styles.bubble} ${styles.bubbleBot}`}>
            <em>pensando…</em>
          </div>
        )}
      </div>

      <div className={styles.suggestRow}>
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className={styles.suggestChip}
            onClick={() => void send(q)}
            disabled={busy}
          >
            {q}
          </button>
        ))}
      </div>

      <div className={styles.voiceRow}>
        <label>
          <input
            type="checkbox"
            checked={voiceOn}
            onChange={(e) => setVoiceOn(e.target.checked)}
          />{" "}
          TTS ElevenLabs
        </label>
        <span>·</span>
        <span>
          Stop activo: <strong>{currentStopId}</strong>
        </span>
      </div>

      <div className={styles.composer}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu pregunta…"
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(text);
          }}
          disabled={busy}
        />
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={listening ? stopListening : startListening}
          title="Hablar"
        >
          {listening ? "■" : "●"}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void send(text)}
          disabled={busy || !text.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function actionLabel(action: CopilotResponse["actions"][number]): string {
  switch (action.type) {
    case "highlight_truck_slot":
      return `palet ${action.slotId}`;
    case "highlight_stop":
      return `parada ${action.stopId}`;
    case "show_reasoning":
      return `motivos ${action.stopId}`;
    default:
      return "accion";
  }
}
