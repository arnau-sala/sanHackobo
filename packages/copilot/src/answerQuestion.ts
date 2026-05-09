import { buildContext } from "./buildContext";
import { CopilotQuestionInput, CopilotResponse } from "./types";

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function answerUnloadQuestion(input: CopilotQuestionInput): CopilotResponse {
  const context = buildContext(input);
  const stopName = context.currentStop?.clientName ?? input.currentStopId;

  const slotMentions = context.relatedSlots
    .map((slot) => {
      const itemsForStop = (slot.items ?? []).filter(
        (item) => item.stopId === input.currentStopId,
      );
      if (itemsForStop.length === 0) {
        return null;
      }

      const itemText = itemsForStop
        .map((item) => `${item.quantity} ${item.unit} de ${item.productId}`)
        .join(", ");

      return `${itemText} en lateral ${slot.side}, palet ${slot.slotId}`;
    })
    .filter(Boolean)
    .join(". ");

  const returnablesText =
    context.returnableItems.length > 0
      ? `Ademas, en esta parada deberias recoger retornables: ${context.returnableItems
          .map((item) => `${item.quantity} ${item.unit} de ${item.name}`)
          .join(", ")}.`
      : "No hay retornables marcados para esta parada.";

  return {
    answer: `Vale, para ${stopName} tienes que descargar lo siguiente: ${slotMentions || "Todavia no tengo detalle de carga asignado para esta parada."} ${returnablesText}`,
    actions: [
      ...context.relatedSlots.map((slot) => ({
        type: "highlight_truck_slot" as const,
        slotId: slot.slotId,
      })),
      {
        type: "highlight_stop" as const,
        stopId: input.currentStopId,
      },
    ],
    context: {
      currentStopName: stopName,
      sequence: context.routeStop?.sequence,
    },
  };
}

function answerReasoningQuestion(input: CopilotQuestionInput): CopilotResponse {
  const context = buildContext(input);
  const stopName = context.currentStop?.clientName ?? input.currentStopId;
  const reasoning = context.routeStop?.reasoning ?? [];

  return {
    answer:
      reasoning.length > 0
        ? `Vas ahora a ${stopName} por estos motivos: ${reasoning.join("; ")}.`
        : `Ahora mismo no tengo razonamiento detallado para ${stopName}, pero esta parada aparece en la secuencia ${context.routeStop?.sequence ?? "N/A"}.`,
    actions: [
      {
        type: "highlight_stop",
        stopId: input.currentStopId,
      },
      {
        type: "show_reasoning",
        stopId: input.currentStopId,
      },
    ],
    context: {
      currentStopName: stopName,
      sequence: context.routeStop?.sequence,
    },
  };
}

function answerReturnablesQuestion(input: CopilotQuestionInput): CopilotResponse {
  const context = buildContext(input);

  return {
    answer:
      context.returnableItems.length > 0
        ? `Perfecto, en esta parada recoge: ${context.returnableItems
            .map((item) => `${item.quantity} ${item.unit} de ${item.name}`)
            .join(", ")}.`
        : "En esta parada no tengo retornables registrados.",
    actions: [
      {
        type: "highlight_stop",
        stopId: input.currentStopId,
      },
    ],
  };
}

function answerSwapQuestion(input: CopilotQuestionInput): CopilotResponse {
  const text = normalizeText(input.question);
  const matches = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));

  if (matches.length < 2) {
    return {
      answer:
        "Puedo simular cambios de paradas si me indicas dos posiciones. Por ejemplo: cambiar parada 5 por 8.",
      actions: [],
    };
  }

  const [a, b] = matches;
  return {
    answer: `Simulacion rapida: si cambias la parada ${a} por la ${b}, puede subir la desviacion de ruta y la complejidad de descarga. Para confirmarlo con precision, te recomiendo recalcular optimizeRoute y optimizeLoad.`,
    actions: [],
  };
}

export function answerCopilotQuestion(
  input: CopilotQuestionInput,
): CopilotResponse {
  const normalized = normalizeText(input.question);

  if (
    normalized.includes("donde") ||
    normalized.includes("descargar") ||
    normalized.includes("mercancia")
  ) {
    return answerUnloadQuestion(input);
  }

  if (
    normalized.includes("por que") ||
    normalized.includes("porque") ||
    normalized.includes("primero")
  ) {
    return answerReasoningQuestion(input);
  }

  if (
    normalized.includes("retornable") ||
    normalized.includes("retornables") ||
    normalized.includes("recoger")
  ) {
    return answerReturnablesQuestion(input);
  }

  if (normalized.includes("cambio") || normalized.includes("parada")) {
    return answerSwapQuestion(input);
  }

  return {
    answer:
      "Te puedo ayudar con la descarga actual, la ubicacion en el camion, los motivos de ruta, los retornables y la simulacion de cambios de paradas.",
    actions: [],
  };
}
