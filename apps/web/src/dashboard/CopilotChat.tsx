/**
 * Copiloto IA — MODO CONDUCCION (solo voz).
 *
 * El conductor está conduciendo y NO puede mirar la pantalla ni escribir.
 * Diseño:
 *   - Botón de micrófono GRANDE y siempre visible
 *   - Las respuestas del bot se reproducen automáticamente por voz (TTS)
 *   - Chips de preguntas rápidas GRANDES para tocar sin mirar
 *   - El historial de chat se muestra pero el conductor no necesita leerlo
 *   - Indicador visual de estado (escuchando / pensando / hablando)
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

type CopilotState = "idle" | "listening" | "thinking" | "speaking";

interface CopilotChatProps {
  className?: string;
  currentStopId: string;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  inputData: InputData;
  onAction?: (action: CopilotResponse["actions"][number]) => void;
}

const QUICK_ACTIONS = [
  { emoji: "📦", label: "¿Qué descargo?", question: "Donde tengo que descargar?" },
  { emoji: "🔄", label: "Retornables", question: "Que retornables recogemos?" },
  { emoji: "❓", label: "¿Por qué aquí?", question: "Por que vamos primero aqui?" },
  { emoji: "🔀", label: "Cambiar orden", question: "Cambio la parada 4 por la 9?" },
];

export function CopilotChat({
  className,
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
      text: "Copiloto listo. Pulsa el micrófono o una acción rápida.",
    },
  ]);
  const [copilotState, setCopilotState] = useState<CopilotState>("idle");
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
    if (!trimmed || copilotState !== "idle") return;
    setCopilotState("thinking");
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
        { withVoice: true },
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

      // Auto-play voice response
      if (result.ttsAudioBase64 && result.ttsMimeType) {
        setCopilotState("speaking");
        const audio = new Audio(
          `data:${result.ttsMimeType};base64,${result.ttsAudioBase64}`,
        );
        audioRef.current = audio;
        audio.onended = () => setCopilotState("idle");
        audio.onerror = () => setCopilotState("idle");
        await audio.play().catch(() => setCopilotState("idle"));
      } else {
        setCopilotState("idle");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "bot",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
      setCopilotState("idle");
    }
  }

  function startListening() {
    if (copilotState !== "idle") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
    rec.onend = () => {
      if (copilotState === "listening") setCopilotState("idle");
    };
    rec.onerror = () => setCopilotState("idle");
    rec.start();
    recognitionRef.current = rec;
    setCopilotState("listening");
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setCopilotState("idle");
  }

  function handleMicClick() {
    if (copilotState === "listening") {
      stopListening();
    } else if (copilotState === "idle") {
      startListening();
    }
    // If thinking or speaking, ignore click
  }

  const stateConfig: Record<CopilotState, { icon: string; label: string; color: string }> = {
    idle: { icon: "🎤", label: "Pulsa para hablar", color: "var(--text-3)" },
    listening: { icon: "●", label: "Escuchando...", color: "var(--damm-red)" },
    thinking: { icon: "⏳", label: "Pensando...", color: "var(--warn)" },
    speaking: { icon: "🔊", label: "Respondiendo...", color: "var(--ok)" },
  };

  const state = stateConfig[copilotState];

  return (
    <div className={[styles.panel, className].filter(Boolean).join(" ")}>
      <div className={styles.panelHeader}>
        <h3>🤖 Copiloto IA</h3>
        <span style={{ color: state.color, fontWeight: 600 }}>
          {state.label}
        </span>
      </div>

      {/* Minimal chat history — driver doesn't need to read this */}
      <div className={styles.chatBody} ref={bodyRef}>
        {messages.slice(-3).map((m) => (
          <div
            key={m.id}
            className={`${styles.bubble} ${
              m.role === "user" ? styles.bubbleUser : styles.bubbleBot
            }`}
          >
            {m.text}
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
        {copilotState === "thinking" && (
          <div className={`${styles.bubble} ${styles.bubbleBot}`}>
            <em>pensando…</em>
          </div>
        )}
      </div>

      {/* Quick action chips — large touch targets */}
      <div className={styles.suggestRow}>
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.question}
            type="button"
            className={styles.suggestChip}
            onClick={() => void send(qa.question)}
            disabled={copilotState !== "idle"}
            title={qa.question}
          >
            {qa.emoji} {qa.label}
          </button>
        ))}
      </div>

      {/* BIG mic button — main interaction */}
      <div className={styles.voiceComposer}>
        <button
          type="button"
          className={styles.voiceBtnLarge}
          data-listening={copilotState === "listening"}
          data-state={copilotState}
          onClick={handleMicClick}
          disabled={copilotState === "thinking" || copilotState === "speaking"}
          title={state.label}
          style={
            copilotState === "speaking"
              ? { borderColor: "var(--ok)", background: "rgba(34,197,94,0.15)" }
              : copilotState === "thinking"
                ? { borderColor: "var(--warn)", background: "rgba(245,158,11,0.1)" }
                : undefined
          }
        >
          {state.icon}
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
