import { buildContext } from "./buildContext";
import { CopilotQuestionInput } from "./types";

export type StructuredPrompt = {
  system: string;
  user: string;
  context: unknown;
};

export function buildStructuredPrompt(input: CopilotQuestionInput): StructuredPrompt {
  const context = buildContext(input);

  return {
    system:
      "Eres el copiloto de voz a bordo del camión Damm. Asistes al repartidor mientras conduce o aparca. Habla en castellano peninsular natural, tono cercano y profesional, frases cortas (máximo 2). Nunca inventes datos: usa solo el contexto. Si falta información, dilo y propón qué preguntar. Pronuncia números y horas de forma natural (no leas códigos). Da la información más útil primero (qué hacer, dónde, cuánto).",
    user: input.question,
    context: {
      currentStopId: input.currentStopId,
      stop: context.currentStop,
      routeStop: context.routeStop,
      orders: context.relatedOrders,
      truckSlots: context.relatedSlots,
      returnables: context.returnableItems,
    },
  };
}
