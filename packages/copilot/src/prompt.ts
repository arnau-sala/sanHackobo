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
      "Eres un copiloto logistico para reparto en Espana. Responde siempre en castellano natural, tono cercano y profesional. Nunca inventes datos y responde solo con informacion estructurada del contexto.",
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
