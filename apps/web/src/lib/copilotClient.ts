/**
 * Cliente del copiloto: prefiere la API (backend integrado, mock end-to-end)
 * y cae al motor en navegador si la API no responde. Esto permite probar la
 * UI tanto con `npm run dev:web` aislado como con el stack completo.
 */
import { runCopilot } from "@damm/copilot";
import type { CopilotQuestionInput, CopilotResponse } from "@damm/copilot";

export type CopilotClientResult = {
  response: CopilotResponse;
  source: "api" | "local";
  ttsAudioBase64?: string;
  ttsMimeType?: string;
  error?: string;
};

// El TTS de ElevenLabs puede tardar entre 1.5 y 6s según texto y red.
// Con 4s veíamos timeouts y la voz se silenciaba. Subimos a 15s.
const API_TIMEOUT_MS = 15000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

export async function askCopilot(
  input: CopilotQuestionInput,
  opts: { withVoice?: boolean } = {},
): Promise<CopilotClientResult> {
  const endpoint = opts.withVoice ? "/api/voice/query" : "/api/copilot";
  try {
    const res = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      API_TIMEOUT_MS,
    );
    if (!res.ok) {
      throw new Error(`API ${res.status}`);
    }
    const data = (await res.json()) as {
      response: CopilotResponse;
      tts?: { audioBase64: string; mimeType: string };
    };
    return {
      response: data.response,
      source: "api",
      ttsAudioBase64: data.tts?.audioBase64,
      ttsMimeType: data.tts?.mimeType,
    };
  } catch (err) {
    const local = runCopilot(input);
    return {
      response: local.response,
      source: "local",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await withTimeout(fetch("/health"), 1500);
    return res.ok;
  } catch {
    return false;
  }
}
