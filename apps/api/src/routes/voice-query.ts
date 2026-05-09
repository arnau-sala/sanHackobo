import { runCopilot } from "../../../../packages/copilot/src";
import { CopilotQuestionInput } from "../../../../packages/copilot/src/types";
import { synthesizeWithElevenLabs } from "../services/elevenlabs";

export type HandlerResult = {
  status: number;
  body: unknown;
};

type VoiceQueryInput = CopilotQuestionInput & {
  voiceId?: string;
  modelId?: string;
};

export async function voiceQueryRoute(body: unknown): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: { error: "Body JSON invalido" },
    };
  }

  const input = body as VoiceQueryInput;
  if (!input.currentStopId || !input.question) {
    return {
      status: 400,
      body: { error: "Faltan campos obligatorios: currentStopId y question" },
    };
  }

  const output = runCopilot(input);

  try {
    const tts = await synthesizeWithElevenLabs({
      text: output.response.answer,
      voiceId: input.voiceId,
      modelId: input.modelId,
    });

    return {
      status: 200,
      body: {
        ...output,
        tts,
      },
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "No se pudo sintetizar audio con ElevenLabs",
        details: String(error),
        response: output.response,
      },
    };
  }
}
