import type { LoadKpis, LoadPlan, PalletSlot } from "../types.js";
import { accessRank } from "./buildTruckLayout.js";

/**
 * Calcula los KPIs explicables del LoadPlan.
 *
 * Todas las métricas están en [0,1] excepto truckFillRatio (también [0,1]).
 * Cuanto más alto, mejor (excepto las dos *Complexity).
 */
export function computeLoadKpis(loadPlan: LoadPlan): LoadKpis {
  const slots = loadPlan.palletSlots;
  const allItems = slots.flatMap((s) => s.items);

  // truckFillRatio.
  const totalCap = slots.reduce(
    (a, s) => a + (s.capacityVolume ?? 0),
    0,
  );
  const totalUsed = slots.reduce((a, s) => a + (s.usedVolume ?? 0), 0);
  const truckFillRatio = totalCap > 0 ? clamp01(totalUsed / totalCap) : 0;

  // routeAlignmentScore: para cada item, comparamos su sequence normalizada
  // con el rank normalizado del slot. Promedio de (1 - |dif|).
  const seqs = allItems.map((i) => i.sequence);
  const minSeq = seqs.length ? Math.min(...seqs) : 0;
  const maxSeq = seqs.length ? Math.max(...seqs) : 1;
  const seqSpan = Math.max(1, maxSeq - minSeq);
  let alignmentSum = 0;
  let alignmentCount = 0;
  for (const slot of slots) {
    if (slot.accessPriority === "returnables") continue;
    const slotRank = accessRank(slot.accessPriority); // 0,1,2
    const slotNorm = slotRank / 2;
    for (const item of slot.items) {
      const seqNorm = (item.sequence - minSeq) / seqSpan;
      alignmentSum += 1 - Math.abs(seqNorm - slotNorm);
      alignmentCount += 1;
    }
  }
  const routeAlignmentScore =
    alignmentCount > 0 ? clamp01(alignmentSum / alignmentCount) : 0;

  // heavyItemsBottomRatio.
  const heavy = allItems.filter(
    (i) => i.handlingType === "keg" || isHeavy(i),
  );
  const heavyOk = heavy.filter((i) => i.layer === "bottom").length;
  const heavyItemsBottomRatio = heavy.length > 0 ? heavyOk / heavy.length : 1;

  // stopsWithDirectAccessRatio: paradas cuyos items están todos en slots
  // 'high' o 'medium'.
  const slotPriorityById = new Map(
    slots.map((s) => [s.slotId, s.accessPriority]),
  );
  const stops = new Map<string, { ok: number; total: number }>();
  for (const slot of slots) {
    for (const item of slot.items) {
      const entry = stops.get(item.stopId) ?? { ok: 0, total: 0 };
      entry.total += 1;
      const pr = slotPriorityById.get(slot.slotId);
      if (pr === "high" || pr === "medium") entry.ok += 1;
      stops.set(item.stopId, entry);
    }
  }
  const stopsWithDirectAccessRatio =
    stops.size > 0
      ? Array.from(stops.values()).filter((s) => s.ok === s.total).length /
        stops.size
      : 0;

  // estimatedPickingComplexity: cuanto más dispersa esté una referencia entre
  // slots, más difícil es prepararla. Calculamos para cada productId el
  // número de slots distintos en los que aparece y normalizamos por |slots|.
  const productSpread = new Map<string, Set<string>>();
  for (const slot of slots) {
    for (const item of slot.items) {
      const set = productSpread.get(item.productId) ?? new Set<string>();
      set.add(slot.slotId);
      productSpread.set(item.productId, set);
    }
  }
  const totalProducts = productSpread.size;
  const slotsCount = Math.max(1, slots.length);
  const pickingDispersion =
    totalProducts > 0
      ? Array.from(productSpread.values()).reduce(
          (a, set) => a + (set.size - 1) / Math.max(1, slotsCount - 1),
          0,
        ) / totalProducts
      : 0;
  // Picking complexity es la dispersión: 0 = todos los productos en 1 slot, 1 = cada
  // producto disperso en todos los slots.
  const estimatedPickingComplexity = clamp01(pickingDispersion);

  // estimatedUnloadingComplexity: cuanto más dispersos los items de un mismo
  // stopId entre slots, más difícil es la descarga. Mismo cálculo aplicado a
  // stopId.
  const stopSpread = new Map<string, Set<string>>();
  for (const slot of slots) {
    for (const item of slot.items) {
      const set = stopSpread.get(item.stopId) ?? new Set<string>();
      set.add(slot.slotId);
      stopSpread.set(item.stopId, set);
    }
  }
  const totalStops = stopSpread.size;
  const unloadingDispersion =
    totalStops > 0
      ? Array.from(stopSpread.values()).reduce(
          (a, set) => a + (set.size - 1) / Math.max(1, slotsCount - 1),
          0,
        ) / totalStops
      : 0;
  const estimatedUnloadingComplexity = clamp01(unloadingDispersion);

  // returnablesReadinessScore.
  const returnablesReadinessScore = computeReturnablesReadiness(loadPlan, slots);

  return {
    estimatedPickingComplexity: round2(estimatedPickingComplexity),
    estimatedUnloadingComplexity: round2(estimatedUnloadingComplexity),
    truckFillRatio: round2(truckFillRatio),
    routeAlignmentScore: round2(routeAlignmentScore),
    returnablesReadinessScore: round2(returnablesReadinessScore),
    heavyItemsBottomRatio: round2(heavyItemsBottomRatio),
    stopsWithDirectAccessRatio: round2(stopsWithDirectAccessRatio),
  };
}

function computeReturnablesReadiness(
  loadPlan: LoadPlan,
  slots: PalletSlot[],
): number {
  const reservedSlots = slots.filter(
    (s) => s.accessPriority === "returnables",
  );
  if (reservedSlots.length === 0) return 0;
  const reservedVolume = reservedSlots.reduce(
    (a, s) => a + (s.capacityVolume ?? 0),
    0,
  );
  const need = loadPlan.returnablesPlan.estimatedReturnableVolume;
  if (need === 0) return 1;
  return clamp01(reservedVolume / need);
}

function isHeavy(item: { handlingType: string; quantity: number }): boolean {
  // Si tenemos handlingType 'keg' o una caja muy pesada (>=20kg/unidad)
  // ya lo etiquetamos como heavy. Como aquí no tenemos peso por unidad,
  // delegamos en el handlingType.
  return item.handlingType === "keg";
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
