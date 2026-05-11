import { buildContext } from "./buildContext";
import { CopilotQuestionInput, CopilotResponse } from "./types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿¡?!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function any(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function num(unit: string): string {
  const u = unit.toLowerCase();
  if (u.startsWith("cax") || u === "caja" || u === "cajas") return "caja";
  if (u.startsWith("bar") || u === "barril") return "barril";
  if (u === "uni" || u === "unidad" || u === "ud") return "unidad";
  if (u === "pal" || u === "palet") return "palet";
  return u;
}

function pluralize(qty: number, singular: string): string {
  if (qty === 1) return `1 ${singular}`;
  if (singular.endsWith("z")) return `${qty} ${singular.slice(0, -1)}ces`;
  if (singular.endsWith("l")) return `${qty} ${singular}es`;
  return `${qty} ${singular}s`;
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

function cleanProductName(name: string): string {
  return name
    .replace(/\s+RET\.?\s*PP$/i, "")
    .replace(/\s+1\/\d+/g, "")
    .replace(/\s+VIDRIO\b.*/i, "")
    .replace(/\s+\d+U\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clientShortName(name: string): string {
  const trimmed = name.replace(/\s+S\.?T\.?\s+JULIA.*/i, "").trim();
  return trimmed.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

// ─── Intents ─────────────────────────────────────────────────────────────────

function answerUnload(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const stopName = ctx.currentStop?.clientName ?? "esta parada";
  const items = ctx.relatedOrders.flatMap((o) => o.items);

  if (items.length === 0) {
    return {
      answer: `No tengo carga registrada para ${clientShortName(stopName)}.`,
      actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
    };
  }

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const top = items.slice(0, 3).map((it) =>
    `${pluralize(it.quantity, num(it.unit))} de ${cleanProductName(it.name)}`,
  );
  const more = items.length > 3 ? `, y ${items.length - 3} referencias más` : "";

  return {
    answer: `En ${clientShortName(stopName)} descargas ${totalUnits} unidades: ${joinList(top)}${more}.`,
    actions: [
      ...ctx.relatedSlots.map((s) => ({ type: "highlight_truck_slot" as const, slotId: s.slotId })),
      { type: "highlight_stop", stopId: input.currentStopId },
    ],
  };
}

function answerLocation(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const slots = ctx.relatedSlots;
  const stopName = ctx.currentStop?.clientName ?? "esta parada";

  if (slots.length === 0) {
    return {
      answer: `No tengo localización de palet para ${clientShortName(stopName)}. Revisa el plano.`,
      actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
    };
  }

  const sides = slots.map((s) => `palet ${s.slotId} en lateral ${s.side ?? "indeterminado"}`);
  return {
    answer: `La mercancía está en ${joinList(sides)}.`,
    actions: slots.map((s) => ({ type: "highlight_truck_slot" as const, slotId: s.slotId })),
  };
}

function answerReasoning(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const stopName = ctx.currentStop?.clientName ?? "esta parada";
  const reasons = ctx.routeStop?.reasoning ?? [];
  const seq = ctx.routeStop?.sequence;

  if (reasons.length === 0) {
    return {
      answer: `${clientShortName(stopName)} es la parada ${seq ?? "?"} de la ruta optimizada.`,
      actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
    };
  }

  return {
    answer: `Vas a ${clientShortName(stopName)} porque ${reasons.slice(0, 2).join("; ")}.`,
    actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
  };
}

function answerReturnables(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  if (ctx.returnableItems.length === 0) {
    return {
      answer: "En esta parada no hay retornables que recoger.",
      actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
    };
  }
  const list = ctx.returnableItems.slice(0, 3).map(
    (r) => `${pluralize(r.quantity, num(r.unit))} de ${cleanProductName(r.name)}`,
  );
  const more = ctx.returnableItems.length > 3 ? `, más ${ctx.returnableItems.length - 3} referencias` : "";
  return {
    answer: `Recoge: ${joinList(list)}${more}.`,
    actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
  };
}

function answerNextStop(input: CopilotQuestionInput): CopilotResponse {
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const idx = sorted.findIndex((s) => s.stopId === input.currentStopId);
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  if (!next) {
    return { answer: "Esta es la última parada. Después vuelves al depósito.", actions: [] };
  }
  const stopData = input.inputData.stops.find((s) => s.id === next.stopId);
  const eta = next.arrivalEta ? `, llegada prevista a las ${next.arrivalEta}` : "";
  return {
    answer: `La siguiente es ${clientShortName(next.clientName ?? stopData?.clientName ?? "")}, parada ${next.sequence}${eta}.`,
    actions: [{ type: "highlight_stop", stopId: next.stopId }],
  };
}

function answerPreviousStop(input: CopilotQuestionInput): CopilotResponse {
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const idx = sorted.findIndex((s) => s.stopId === input.currentStopId);
  if (idx <= 0) return { answer: "Esta es la primera parada, no hay ninguna anterior.", actions: [] };
  const prev = sorted[idx - 1];
  const stopData = input.inputData.stops.find((s) => s.id === prev.stopId);
  return {
    answer: `La parada anterior fue ${clientShortName(prev.clientName ?? stopData?.clientName ?? "")}.`,
    actions: [],
  };
}

function answerProgress(input: CopilotQuestionInput): CopilotResponse {
  const total = input.routePlan.stops.length;
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const idx = sorted.findIndex((s) => s.stopId === input.currentStopId);
  const done = Math.max(0, idx);
  const left = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return {
    answer: `Llevas ${done} de ${total} paradas completadas, un ${pct}%. Te quedan ${left}.`,
    actions: [],
  };
}

function answerEndTime(input: CopilotQuestionInput): CopilotResponse {
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const last = sorted[sorted.length - 1];
  if (!last?.arrivalEta) {
    const mins = (input.routePlan as any).estimatedMinutes;
    if (mins) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return { answer: `La ruta dura aproximadamente ${h ? `${h} horas y ` : ""}${m} minutos.`, actions: [] };
    }
    return { answer: "No tengo hora de fin estimada en los datos.", actions: [] };
  }
  return { answer: `Última entrega prevista sobre las ${last.arrivalEta}.`, actions: [] };
}

function answerCurrentTime(input: CopilotQuestionInput): CopilotResponse {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  return { answer: `Son las ${h}:${m}.`, actions: [] };
}

function answerCash(input: CopilotQuestionInput): CopilotResponse {
  const orders = input.inputData.orders;
  const cashOrders = orders.filter(
    (o: any) => o.paymentType === "CONTADO" || (o.collectionAmount ?? 0) > 0,
  );
  const total = cashOrders.reduce((s, o: any) => s + (o.collectionAmount ?? 0), 0);

  if (cashOrders.length === 0) {
    return { answer: "Hoy no tienes cobros en efectivo. Todos los clientes son a crédito.", actions: [] };
  }
  if (total > 0) {
    return {
      answer: `Tienes que cobrar ${total.toLocaleString("es-ES")} euros en efectivo, en ${cashOrders.length} clientes.`,
      actions: [],
    };
  }
  return {
    answer: `Tienes ${cashOrders.length} clientes que pagan al contado. Confirma el importe en el albarán.`,
    actions: [],
  };
}

function answerLoad(input: CopilotQuestionInput): CopilotResponse {
  const orders = input.inputData.orders;
  const slots = input.loadPlan.palletSlots;
  const totalUnits = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const barrels = orders.reduce(
    (s, o) => s + o.items.filter((i) => /barril|keg/i.test(i.name) || i.unit === "Barril").reduce((ss, i) => ss + i.quantity, 0),
    0,
  );
  const usedSlots = slots.filter((s) => (s.items?.length ?? 0) > 0).length;
  const parts = [`${usedSlots} de ${slots.length} palets`, `${totalUnits} unidades`];
  if (barrels > 0) parts.push(`${barrels} barriles`);
  return { answer: `Llevas ${joinList(parts)}.`, actions: [] };
}

function answerStopCount(input: CopilotQuestionInput): CopilotResponse {
  const total = input.routePlan.stops.length;
  return { answer: `Hoy tienes ${total} paradas en total.`, actions: [] };
}

function answerAddress(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const addr = ctx.currentStop?.address;
  const name = ctx.currentStop?.clientName ?? "este cliente";
  if (!addr) return { answer: `No tengo dirección registrada para ${clientShortName(name)}.`, actions: [] };
  return {
    answer: `${clientShortName(name)} está en ${addr}.`,
    actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
  };
}

function answerPayment(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const order = ctx.relatedOrders[0] as any;
  const name = ctx.currentStop?.clientName ?? "este cliente";
  if (!order?.paymentType) {
    return { answer: `No tengo el método de pago de ${clientShortName(name)}.`, actions: [] };
  }
  if (order.paymentType === "CONTADO") {
    const eur = order.collectionAmount ? `, son ${order.collectionAmount.toLocaleString("es-ES")} euros` : "";
    return { answer: `${clientShortName(name)} paga al contado${eur}.`, actions: [] };
  }
  return { answer: `${clientShortName(name)} es cliente a crédito, no cobras en efectivo.`, actions: [] };
}

function answerCurrentStop(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const name = ctx.currentStop?.clientName ?? "parada actual";
  const addr = ctx.currentStop?.address ?? "";
  const seq = ctx.routeStop?.sequence;
  return {
    answer: `Estás en ${clientShortName(name)}${addr ? `, ${addr}` : ""}. Parada ${seq ?? "?"} de la ruta.`,
    actions: [{ type: "highlight_stop", stopId: input.currentStopId }],
  };
}

function answerAllStops(input: CopilotQuestionInput): CopilotResponse {
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const names = sorted.slice(0, 5).map((s) => {
    const d = input.inputData.stops.find((st) => st.id === s.stopId);
    return `${s.sequence}. ${clientShortName(s.clientName ?? d?.clientName ?? s.stopId)}`;
  });
  const more = sorted.length > 5 ? ` y ${sorted.length - 5} más` : "";
  return { answer: `Las paradas son: ${names.join(", ")}${more}.`, actions: [] };
}

function answerDelay(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const eta = ctx.routeStop?.arrivalEta;
  if (!eta) return { answer: "No tengo datos de retraso para esta parada.", actions: [] };
  return { answer: `La hora prevista de llegada es las ${eta}. Si vas con retraso, avisa al cliente desde el albarán.`, actions: [] };
}

function answerKm(input: CopilotQuestionInput): CopilotResponse {
  const km = (input.routePlan as any).totalKm ?? (input.routePlan as any).totalDistanceKm;
  if (!km) return { answer: "No tengo los kilómetros totales de la ruta en los datos.", actions: [] };
  return { answer: `La ruta tiene ${Math.round(km)} kilómetros en total.`, actions: [] };
}

function answerTruckInfo(input: CopilotQuestionInput): CopilotResponse {
  const v = input.inputData.vehicle;
  const plate = (v as any).plate ?? (v as any).matricula ?? "";
  const slots = input.loadPlan.palletSlots.length;
  return {
    answer: `Tu vehículo es ${v.id}${plate ? `, matrícula ${plate}` : ""}, con ${slots} posiciones de palet.`,
    actions: [],
  };
}

function answerSwap(input: CopilotQuestionInput): CopilotResponse {
  const text = normalize(input.question);
  const matches = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (matches.length < 2) {
    return {
      answer: "Para simular un cambio dime las dos posiciones. Por ejemplo: cambia la cinco por la ocho.",
      actions: [],
    };
  }
  const [a, b] = matches;
  return {
    answer: `Si intercambias la parada ${a} con la ${b} podría subir el tiempo de ruta. Consulta con oficina antes de cambiar.`,
    actions: [],
  };
}

function answerHelp(): CopilotResponse {
  return {
    answer: "Puedo decirte qué descargar, dónde está la mercancía, la siguiente parada, retornables, cobros, dirección, hora de fin o cuántas paradas te quedan. Tú dirás.",
    actions: [],
  };
}

function answerBreak(input: CopilotQuestionInput): CopilotResponse {
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const idx = sorted.findIndex((s) => s.stopId === input.currentStopId);
  const left = sorted.length - Math.max(0, idx);
  if (left <= 3) return { answer: `Solo te quedan ${left} paradas, terminarás pronto.`, actions: [] };
  return { answer: "No tengo pausas programadas en los datos. Coordínalo con el responsable de flota.", actions: [] };
}

function answerTemperature(): CopilotResponse {
  return { answer: "No tengo acceso a la temperatura exterior. Comprueba el termómetro del camión.", actions: [] };
}

function answerFuel(): CopilotResponse {
  return { answer: "No gestiono el combustible desde aquí. Comprueba el marcador del salpicadero.", actions: [] };
}

function answerParking(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const notes = (ctx.currentStop as any)?.parkingNotes ?? (ctx.routeStop as any)?.parkingNotes ?? "";
  if (notes) return { answer: `Notas de aparcamiento: ${notes}.`, actions: [] };
  return { answer: "No tengo notas de aparcamiento para esta parada. Busca zona de carga y descarga cerca.", actions: [] };
}

function answerIncident(): CopilotResponse {
  return {
    answer: "Para registrar una incidencia usa el botón de incidencia en la pantalla de entrega. Si es urgente llama a tu responsable.",
    actions: [],
  };
}

function answerHowManyLeft(input: CopilotQuestionInput): CopilotResponse {
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const idx = sorted.findIndex((s) => s.stopId === input.currentStopId);
  const left = sorted.length - Math.max(0, idx);
  return { answer: `Te quedan ${left} paradas incluyendo la actual.`, actions: [] };
}

function answerEta(input: CopilotQuestionInput): CopilotResponse {
  const ctx = buildContext(input);
  const eta = ctx.routeStop?.arrivalEta;
  if (eta) return { answer: `La hora prevista de llegada aquí era las ${eta}.`, actions: [] };
  const sorted = [...input.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const next = sorted.find((s) => s.stopId !== input.currentStopId && s.sequence > (ctx.routeStop?.sequence ?? 0));
  if (next?.arrivalEta) return { answer: `En la siguiente parada llegarás sobre las ${next.arrivalEta}.`, actions: [] };
  return { answer: "No tengo ETA disponible en este momento.", actions: [] };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function answerCopilotQuestion(input: CopilotQuestionInput): CopilotResponse {
  const t = normalize(input.question);

  if (!t || t.length < 2) return answerHelp();

  // Saludos
  if (any(t, ["hola", "buenos dias", "buenas tardes", "buenas noches", "buenas", "que tal", "que pasa", "ey", "hey", "ola"])) {
    return { answer: "Hola, dime qué necesitas.", actions: [] };
  }

  // Despedidas / gracias
  if (any(t, ["gracias", "muchas gracias", "hasta luego", "adios", "chao", "de nada", "ok gracias", "vale gracias"])) {
    return { answer: "De nada. Cualquier cosa me dices.", actions: [] };
  }

  // Hora actual
  if (any(t, ["que hora es", "que hora son", "dime la hora", "hora actual", "hora es", "hora son"])) {
    return answerCurrentTime(input);
  }

  // Parada actual / dónde estoy
  if (any(t, ["donde estoy", "en que parada estoy", "parada actual", "cliente actual", "donde me encuentro", "que parada es esta", "que cliente es este"])) {
    return answerCurrentStop(input);
  }

  // Próxima parada
  if (any(t, ["siguiente parada", "proxima parada", "siguiente cliente", "proximo cliente", "que viene despues", "donde voy ahora", "donde voy despues", "a donde voy", "quien es el siguiente", "cual es la siguiente", "proxima entrega", "siguiente entrega"])) {
    return answerNextStop(input);
  }

  // Parada anterior
  if (any(t, ["parada anterior", "cliente anterior", "donde estuve antes", "ultima parada"])) {
    return answerPreviousStop(input);
  }

  // Lista de todas las paradas
  if (any(t, ["todas las paradas", "lista de paradas", "todas mis paradas", "dime las paradas", "cuales son las paradas", "ver paradas", "mis paradas de hoy"])) {
    return answerAllStops(input);
  }

  // Cuántas paradas
  if (any(t, ["cuantas paradas", "cuantos clientes", "total paradas", "total clientes", "paradas tengo", "clientes tengo", "paradas hay", "cuantas son"])) {
    return answerStopCount(input);
  }

  // Cuántas quedan
  if (any(t, ["cuantas quedan", "cuanto queda", "paradas quedan", "clientes quedan", "me quedan", "faltan", "cuantas me faltan"])) {
    return answerHowManyLeft(input);
  }

  // Progreso
  if (any(t, ["cuanto llevo", "voy bien", "como voy", "progreso", "por donde voy", "cuanto he hecho", "llevas", "avance"])) {
    return answerProgress(input);
  }

  // Hora de fin / cuándo termino
  if (any(t, ["a que hora termino", "cuando acabo", "cuando termino", "hora de fin", "fin de ruta", "duracion ruta", "cuanto me queda de ruta", "cuando llego al deposito", "cuando vuelvo"])) {
    return answerEndTime(input);
  }

  // ETA
  if (any(t, ["a que hora llego", "cuando llego", "hora de llegada", "eta", "hora prevista", "llegada prevista"])) {
    return answerEta(input);
  }

  // Kilómetros
  if (any(t, ["cuantos kilometros", "cuantos km", "distancia total", "kilometros totales", "km totales", "cuanto hay que recorrer"])) {
    return answerKm(input);
  }

  // Carga total del camión
  if (any(t, ["que llevo", "carga total", "cuanto llevo cargado", "cuantos palets llevo", "barriles llevo", "cuantos barriles", "que hay en el camion", "que tengo cargado"])) {
    return answerLoad(input);
  }

  // Cobros totales
  if (any(t, ["cuanto cobro hoy", "cobros de hoy", "efectivo total", "total a cobrar", "cuanto dinero cobro"])) {
    return answerCash(input);
  }

  // Cobro de este cliente
  if (any(t, ["cobro aqui", "paga este cliente", "como paga", "metodo de pago", "credito", "contado", "cuanto cobro aqui", "cuanto me debe", "que me debe"])) {
    return answerPayment(input);
  }

  // Retornables
  if (any(t, ["retornable", "retornables", "vacios", "envases vacios", "que recojo", "barriles vacios", "que recojo aqui", "retorno"])) {
    return answerReturnables(input);
  }

  // Dirección / dónde está el cliente
  if (any(t, ["direccion", "donde esta el cliente", "donde es", "que calle", "como llego", "donde queda", "direccion del cliente", "donde vivo el cliente", "donde entrego"])) {
    return answerAddress(input);
  }

  // Localización en camión
  if (any(t, ["donde esta la mercancia", "donde esta el palet", "donde estan los palets", "en que palet", "que palet", "que lateral", "lateral", "donde esta el pedido", "en que lado"])) {
    return answerLocation(input);
  }

  // Qué descargo / qué entrego
  if (any(t, ["que descargo", "que bajo", "que dejo", "que entrego", "descargar aqui", "que llevo aqui", "que tengo para este", "pedido de este cliente", "que tiene este cliente", "cuanto descargo", "que productos"])) {
    return answerUnload(input);
  }

  // Por qué esta parada
  if (any(t, ["por que voy aqui", "por que esta parada", "porque voy", "por que es esta", "razon de esta parada", "motivo"])) {
    return answerReasoning(input);
  }

  // Cambio de orden / swap
  if (any(t, ["cambia", "cambiar orden", "intercambia", "swap", "permuta", "cambio de parada", "puedo cambiar"])) {
    return answerSwap(input);
  }

  // Aparcamiento
  if (any(t, ["donde aparco", "donde park", "zona de carga", "aparcamiento", "parking", "donde paro el camion", "donde dejo el camion"])) {
    return answerParking(input);
  }

  // Incidencias
  if (any(t, ["incidencia", "problema", "averia", "accidente", "reporte", "reportar", "algo ha pasado", "hay un problema"])) {
    return answerIncident();
  }

  // Descanso / pausa
  if (any(t, ["descanso", "pausa", "cuando descansamos", "cuando paro", "tengo tiempo de comer", "hora de comer", "puedo parar"])) {
    return answerBreak(input);
  }

  // Temperatura
  if (any(t, ["temperatura", "hace calor", "hace frio", "cuanto grados", "tiempo que hace"])) {
    return answerTemperature();
  }

  // Combustible
  if (any(t, ["gasolina", "gasoil", "combustible", "deposito", "cuanto queda de combustible", "hay que repostar"])) {
    return answerFuel();
  }

  // Vehículo
  if (any(t, ["matricula", "vehiculo", "camion", "que camion tengo", "mi camion", "mi vehiculo", "numero de camion"])) {
    return answerTruckInfo(input);
  }

  // Repetir
  if (any(t, ["repite", "repiteme", "no he oido", "no te he oido", "mas alto", "que has dicho", "otra vez"])) {
    return answerUnload(input);
  }

  // Ayuda
  if (any(t, ["ayuda", "que puedes hacer", "que sabes hacer", "opciones", "que me puedes decir", "en que me ayudas", "para que sirves", "como te uso"])) {
    return answerHelp();
  }

  // Fallbacks por palabras clave sueltas
  if (t.includes("siguiente") || t.includes("proxim")) return answerNextStop(input);
  if (t.includes("parada") && t.includes("queda")) return answerHowManyLeft(input);
  if (t.includes("parada")) return answerCurrentStop(input);
  if (t.includes("descarg") || t.includes("entrega") || t.includes("pedido")) return answerUnload(input);
  if (t.includes("palet") || t.includes("lateral") || t.includes("camion")) return answerLocation(input);
  if (t.includes("cobr") || t.includes("dinero") || t.includes("efectivo")) return answerCash(input);
  if (t.includes("retorn") || t.includes("envase") || t.includes("vacio")) return answerReturnables(input);
  if (t.includes("direcci") || t.includes("calle") || t.includes("donde")) return answerAddress(input);
  if (t.includes("hora") || t.includes("tiempo") || t.includes("cuanto")) return answerEndTime(input);
  if (t.includes("cliente")) return answerCurrentStop(input);

  // Fallback final — al menos responde con el resumen de la parada actual
  return answerUnload(input);
}
