import { runCopilot } from "../../../../packages/copilot/src";
import { CopilotQuestionInput } from "../../../../packages/copilot/src/types";
import {
  synthesizeWithElevenLabs,
  transcribeWithElevenLabs,
} from "../services/elevenlabs";

export type HandlerResult = {
  status: number;
  body: unknown;
};

type VoiceHandsfreeInput = Omit<CopilotQuestionInput, "question"> & {
  audioBase64: string;
  audioMimeType?: string;
  languageCode?: string;
  voiceId?: string;
  ttsModelId?: string;
  sttModelId?: string;
};

export async function voiceHandsfreeRoute(body: unknown): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: { error: "Body JSON invalido" },
    };
  }

  const input = body as VoiceHandsfreeInput;
  if (!input.currentStopId || !input.audioBase64) {
    return {
      status: 400,
      body: { error: "Faltan campos obligatorios: currentStopId y audioBase64" },
    };
  }

  try {
    const stt = await transcribeWithElevenLabs({
      audioBase64: input.audioBase64,
      mimeType: input.audioMimeType,
      modelId: input.sttModelId,
      languageCode: input.languageCode,
    });

    const copilotInput: CopilotQuestionInput = {
      currentStopId: input.currentStopId,
      question: stt.transcript,
      routePlan: input.routePlan,
      loadPlan: input.loadPlan,
      inputData: input.inputData,
    };

    const output = runCopilot(copilotInput);
    const tts = await synthesizeWithElevenLabs({
      text: output.response.answer,
      voiceId: input.voiceId,
      modelId: input.ttsModelId,
    });

    return {
      status: 200,
      body: {
        transcript: stt.transcript,
        response: output.response,
        prompt: output.prompt,
        tts,
      },
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "No se pudo completar el flujo de voz manos libres",
        details: String(error),
      },
    };
  }
}
