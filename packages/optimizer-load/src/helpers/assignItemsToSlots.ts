import type {
  EnrichedItem,
  InputData,
  LoadedItem,
  Order,
  PalletSlot,
  ReturnablesPlan,
  RouteBlock,
  RoutePlan,
  RouteStop,
  Stop,
} from "../types.js";
import {
  classifyHandlingType,
  inferReturnable,
  inferStackable,
} from "./classifyHandlingType.js";
import {
  estimateUnitVolume,
  estimateUnitWeight,
} from "./estimateItemSize.js";
import { chooseLayer } from "./chooseLayer.js";
import { accessRank } from "./buildTruckLayout.js";

interface AssignmentContext {
  slotsById: Map<string, PalletSlot>;
  blocksBySequence: Map<number, RouteBlock>;
  stopsById: Map<string, Stop>;
  ordersByStop: Map<string, Order[]>;
  routeStopsById: Map<string, RouteStop>;
}

/**
 * Resultado del asignador: actualiza los slots in-place y devuelve un plan
 * de retornables con estimación de volumen y peso de envases que vuelven.
 */
export interface AssignResult {
  returnablesPlan: ReturnablesPlan;
  enrichedItems: Array<{
    stopId: string;
    productId: string;
    item: EnrichedItem;
    placedSlotId: string | null;
  }>;
}

/**
 * Asigna los items de cada pedido a los slots del camión siguiendo la
 * estrategia híbrida por bloques de ruta.
 */
export function assignItemsToSlots(
  inputData: InputData,
  routePlan: RoutePlan,
  blocks: RouteBlock[],
  slots: PalletSlot[],
): AssignResult {
  // 1. Index lookup tables.
  const ctx: AssignmentContext = {
    slotsById: new Map(slots.map((s) => [s.slotId, s])),
    blocksBySequence: new Map(),
    stopsById: new Map(inputData.stops.map((s) => [s.id, s])),
    ordersByStop: groupOrdersByStop(inputData.orders),
    routeStopsById: new Map(routePlan.stops.map((rs) => [rs.stopId, rs])),
  };
  for (const b of blocks) {
    for (let s = b.sequenceRange.from; s <= b.sequenceRange.to; s++) {
      ctx.blocksBySequence.set(s, b);
    }
    // Adornamos los slots con su rango/bloque.
    for (const slotId of b.assignedSlots) {
      const slot = ctx.slotsById.get(slotId);
      if (!slot) continue;
      // Si un slot termina asignado a varios bloques, mantenemos la unión
      // como rango de secuencia y marcamos el slot como mixto.
      if (!slot.routeBlock) {
        slot.routeBlock = b.id;
        slot.sequenceRange = { ...b.sequenceRange };
      } else {
        slot.routeBlock = `${slot.routeBlock}+${b.id}`;
        slot.sequenceRange = {
          from: Math.min(slot.sequenceRange!.from, b.sequenceRange.from),
          to: Math.max(slot.sequenceRange!.to, b.sequenceRange.to),
        };
        if (slot.reservedFor !== "returnables") slot.reservedFor = "mixed";
      }
    }
  }

  // 2. Recorremos las paradas en orden de la ruta y plantamos cada item.
  const sortedRouteStops = [...routePlan.stops].sort(
    (a, b) => a.sequence - b.sequence,
  );

  const enrichedTrace: AssignResult["enrichedItems"] = [];
  let returnableVolume = 0;
  let returnableWeight = 0;
  const returnablesNotes: string[] = [];

  for (const routeStop of sortedRouteStops) {
    const stop = ctx.stopsById.get(routeStop.stopId);
    if (!stop) continue;
    const orders = ctx.ordersByStop.get(routeStop.stopId) ?? [];
    const block = ctx.blocksBySequence.get(routeStop.sequence);
    if (!block) continue;

    // Slots candidatos para esta parada (en orden de accesibilidad).
    const candidateSlots = block.assignedSlots
      .map((id) => ctx.slotsById.get(id))
      .filter((s): s is PalletSlot => !!s)
      .sort(
        (a, b) => accessRank(a.accessPriority) - accessRank(b.accessPriority),
      );

    // Para cada item, lo enriquecemos y lo colocamos.
    for (const order of orders) {
      for (const item of order.items) {
        const enriched = enrichItem(item);

        if (enriched.returnable) {
          // El cliente devuelve este envase tras la entrega. Lo entregamos
          // igualmente, pero contamos su volumen para el plan de retornables.
          returnableVolume += enriched.totalVolume;
          returnableWeight += enriched.totalWeight;
        }

        const placement = pickSlotForItem(
          candidateSlots,
          slots,
          enriched,
          routeStop,
          block.id,
        );

        if (!placement) {
          enrichedTrace.push({
            stopId: routeStop.stopId,
            productId: enriched.productId,
            item: enriched,
            placedSlotId: null,
          });
          continue;
        }

        const loaded: LoadedItem = {
          stopId: routeStop.stopId,
          sequence: routeStop.sequence,
          clientName: stop.clientName,
          productId: enriched.productId,
          name: enriched.name,
          quantity: enriched.quantity,
          unit: enriched.unit,
          layer: chooseLayer(enriched),
          accessSide: normalizeSide(placement.slot.side),
          handlingType: enriched.handlingType,
          returnable: enriched.returnable,
          reason: placement.reason,
        };

        placement.slot.items.push(loaded);
        placement.slot.usedVolume =
          (placement.slot.usedVolume ?? 0) + enriched.totalVolume;
        placement.slot.usedWeight =
          (placement.slot.usedWeight ?? 0) + enriched.totalWeight;
        placement.slot.fillRatio =
          (placement.slot.usedVolume ?? 0) /
          Math.max(0.0001, placement.slot.capacityVolume ?? 1);

        enrichedTrace.push({
          stopId: routeStop.stopId,
          productId: enriched.productId,
          item: enriched,
          placedSlotId: placement.slot.slotId,
        });
      }
    }
  }

  // 3. Plan de retornables: slot reservado + estimaciones.
  const reservedSlots = slots
    .filter((s) => s.accessPriority === "returnables")
    .map((s) => s.slotId);

  if (reservedSlots.length === 0) {
    returnablesNotes.push(
      "No hay slot reservado para retornables; se recomienda reservar el palet trasero.",
    );
  } else {
    returnablesNotes.push(
      `Reservado(s) ${reservedSlots.join(", ")} para retornables y envases.`,
    );
    const reservedVolume = reservedSlots.reduce(
      (acc, id) =>
        acc + (ctx.slotsById.get(id)?.capacityVolume ?? 0),
      0,
    );
    if (returnableVolume > reservedVolume * 0.95) {
      returnablesNotes.push(
        `Volumen estimado de retornables (${returnableVolume.toFixed(
          2,
        )} m³) cercano o superior al reservado (${reservedVolume.toFixed(
          2,
        )} m³).`,
      );
    }
  }

  return {
    returnablesPlan: {
      reservedSlots,
      estimatedReturnableVolume: round2(returnableVolume),
      estimatedReturnableWeight: round1(returnableWeight),
      notes: returnablesNotes,
    },
    enrichedItems: enrichedTrace,
  };
}

// ---------------- helpers privados ----------------

function groupOrdersByStop(orders: Order[]): Map<string, Order[]> {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    const list = map.get(o.stopId) ?? [];
    list.push(o);
    map.set(o.stopId, list);
  }
  return map;
}

function enrichItem(item: import("../types.js").OrderItem): EnrichedItem {
  const handlingType = classifyHandlingType(item);
  const v = estimateUnitVolume(item, handlingType);
  const w = estimateUnitWeight(item, handlingType);
  const totalVolume = v.value * Math.max(1, item.quantity);
  const totalWeight = w.value * Math.max(1, item.quantity);
  return {
    ...item,
    handlingType,
    returnable: inferReturnable(item, handlingType),
    stackable: inferStackable(item, handlingType),
    totalVolume,
    totalWeight,
    estimated: {
      volume: v.estimated,
      weight: w.estimated,
      handlingType: !item.handlingType,
    },
  };
}

function normalizeSide(s: PalletSlot["side"]): LoadedItem["accessSide"] {
  return s === "center" ? "rear" : s;
}

interface Placement {
  slot: PalletSlot;
  reason: string;
}

/**
 * Estrategia de elección de slot para un item.
 *
 * Premisas:
 *   - Items pesados (keg, >=25 kg/unidad) → bottom del slot del bloque
 *     menos cargado en peso.
 *   - Si ya hay un slot del bloque con la misma referencia y conserva
 *     suficiente holgura (≤80% lleno), preferimos consolidarlo allí
 *     (agrupación por referencia → carga rápida en almacén).
 *   - En caso contrario, balanceamos: slot del bloque con mayor holgura
 *     de volumen disponible.
 *   - Overflow al resto del camión solo si el bloque está realmente
 *     saturado.
 */
function pickSlotForItem(
  blockSlots: PalletSlot[],
  allSlots: PalletSlot[],
  item: EnrichedItem,
  routeStop: RouteStop,
  blockId: string,
): Placement | null {
  const unitWeight = item.totalWeight / Math.max(1, item.quantity);
  const heavy = item.handlingType === "keg" || unitWeight >= 25;

  // 1. Items pesados: slot del bloque con menor peso acumulado y holgura.
  if (heavy) {
    const sorted = [...blockSlots]
      .filter((s) => hasRoom(s, item))
      .sort((a, b) => (a.usedWeight ?? 0) - (b.usedWeight ?? 0));
    if (sorted.length > 0) {
      return {
        slot: sorted[0],
        reason: `Item pesado (${item.handlingType}) colocado en ${sorted[0].slotId} (slot del ${blockId} con menor peso).`,
      };
    }
  }

  // 2. Agrupar por referencia dentro del bloque solo si el slot conserva
  //    holgura razonable (<=80% lleno). Esto evita amontonar todas las cajas
  //    de ED13 en el primer slot del bloque y dejar P4/P6 vacíos.
  const sameRefRoomy = blockSlots.find(
    (s) =>
      s.items.some((i) => i.productId === item.productId) &&
      utilization(s) < 0.8 &&
      hasRoom(s, item),
  );
  if (sameRefRoomy) {
    return {
      slot: sameRefRoomy,
      reason: `Agrupado con misma referencia ${item.productId} en ${sameRefRoomy.slotId} (${blockId}).`,
    };
  }

  // 3. Slot del bloque con más holgura de volumen.
  const roomiest = [...blockSlots]
    .filter((s) => hasRoom(s, item))
    .sort((a, b) => remainingVolume(b) - remainingVolume(a))[0];
  if (roomiest) {
    return {
      slot: roomiest,
      reason: `Asignado al ${roomiest.slotId} en ${blockId} (sec. ${routeStop.sequence}, balance de carga del bloque).`,
    };
  }

  // 4. Overflow: slot de delivery fuera del bloque con la mayor holgura.
  const overflow = allSlots
    .filter((s) => s.reservedFor !== "returnables" && hasRoom(s, item))
    .sort((a, b) => {
      const acc =
        accessRank(a.accessPriority) - accessRank(b.accessPriority);
      if (acc !== 0) return acc;
      return remainingVolume(b) - remainingVolume(a);
    })[0];
  if (overflow) {
    return {
      slot: overflow,
      reason: `Overflow: bloque ${blockId} saturado, reubicado en ${overflow.slotId}.`,
    };
  }

  return null;
}

function hasRoom(slot: PalletSlot, item: EnrichedItem): boolean {
  const cap = slot.capacityVolume ?? Infinity;
  const used = slot.usedVolume ?? 0;
  return used + item.totalVolume <= cap * 1.02; // 2% tolerancia
}

function utilization(slot: PalletSlot): number {
  const cap = slot.capacityVolume ?? 1;
  return (slot.usedVolume ?? 0) / Math.max(0.0001, cap);
}

function remainingVolume(slot: PalletSlot): number {
  const cap = slot.capacityVolume ?? 0;
  return cap - (slot.usedVolume ?? 0);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
