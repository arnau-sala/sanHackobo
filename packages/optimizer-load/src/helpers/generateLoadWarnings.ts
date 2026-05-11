import type { AssignResult } from "./assignItemsToSlots.js";
import type {
  InputData,
  LoadPlan,
  LoadWarning,
  PalletSlot,
} from "../types.js";

/**
 * Genera warnings operativos a partir del LoadPlan.
 *
 *   - missing_data: faltan volumen o peso en items concretos.
 *   - heavy_item: barril/keg colocado fuera de bottom.
 *   - capacity: slot que excede su capacidad de volumen o peso.
 *   - returnables: no hay slot reservado o capacidad insuficiente.
 *   - access: parada con sequence baja colocada en slot 'low'.
 *   - stacking: item no apilable en bottom con cosas encima en el mismo slot
 *     (heurística simple: si hay >1 item en bottom y alguno no es stackable).
 */
export function generateLoadWarnings(
  loadPlan: LoadPlan,
  inputData: InputData,
  assign: AssignResult,
): LoadWarning[] {
  const warnings: LoadWarning[] = [];

  // missing_data
  const missing = assign.enrichedItems.filter(
    (e) =>
      e.item.estimated.volume ||
      e.item.estimated.weight ||
      e.item.estimated.handlingType,
  );
  if (missing.length > 0) {
    const samples = missing.slice(0, 3).map((m) => m.item.productId).join(", ");
    warnings.push({
      type: "missing_data",
      severity: missing.length > 10 ? "warning" : "info",
      message: `Se han estimado por defaults volumen/peso/handlingType de ${missing.length} items (ej: ${samples}).`,
    });
  }

  // capacity
  for (const slot of loadPlan.palletSlots) {
    const cap = slot.capacityVolume ?? Infinity;
    const used = slot.usedVolume ?? 0;
    if (used > cap * 1.0) {
      warnings.push({
        type: "capacity",
        severity: used > cap * 1.05 ? "critical" : "warning",
        message: `Slot ${slot.slotId} excede capacidad de volumen (${used.toFixed(2)}/${cap.toFixed(2)} m³).`,
        relatedSlotId: slot.slotId,
      });
    }
    const wcap = slot.capacityWeight ?? Infinity;
    const wused = slot.usedWeight ?? 0;
    if (wused > wcap) {
      warnings.push({
        type: "capacity",
        severity: "critical",
        message: `Slot ${slot.slotId} excede capacidad de peso (${wused.toFixed(0)}/${wcap.toFixed(0)} kg).`,
        relatedSlotId: slot.slotId,
      });
    }
  }

  // heavy_item
  for (const slot of loadPlan.palletSlots) {
    for (const it of slot.items) {
      if (it.handlingType === "keg" && it.layer !== "bottom") {
        warnings.push({
          type: "heavy_item",
          severity: "warning",
          message: `Barril ${it.name} (${it.productId}) no está en layer bottom (slot ${slot.slotId}).`,
          relatedSlotId: slot.slotId,
          relatedProductId: it.productId,
          relatedStopId: it.stopId,
        });
      }
    }
  }

  // access: paradas tempranas en slots low.
  const lowSlots = new Set(
    loadPlan.palletSlots
      .filter((s) => s.accessPriority === "low")
      .map((s) => s.slotId),
  );
  if (lowSlots.size > 0) {
    const totalStops = inputData.stops.length;
    const earlyThreshold = Math.max(1, Math.ceil(totalStops * 0.33));
    for (const slot of loadPlan.palletSlots) {
      if (!lowSlots.has(slot.slotId)) continue;
      for (const it of slot.items) {
        if (it.sequence <= earlyThreshold) {
          warnings.push({
            type: "access",
            severity: "warning",
            message: `Parada temprana sec. ${it.sequence} (${it.clientName}) cargada en slot de acceso bajo ${slot.slotId}.`,
            relatedSlotId: slot.slotId,
            relatedStopId: it.stopId,
            relatedProductId: it.productId,
          });
        }
      }
    }
  }

  // returnables
  if (loadPlan.returnablesPlan.reservedSlots.length === 0) {
    warnings.push({
      type: "returnables",
      severity: "warning",
      message:
        "No hay ningún slot reservado para retornables. Se recomienda reservar el palet trasero.",
    });
  } else {
    const reservedVolume = loadPlan.palletSlots
      .filter((s) =>
        loadPlan.returnablesPlan.reservedSlots.includes(s.slotId),
      )
      .reduce((a, s) => a + (s.capacityVolume ?? 0), 0);
    if (
      loadPlan.returnablesPlan.estimatedReturnableVolume >
      reservedVolume * 0.95
    ) {
      warnings.push({
        type: "returnables",
        severity: "warning",
        message: `Volumen estimado de retornables (${loadPlan.returnablesPlan.estimatedReturnableVolume.toFixed(2)} m³) cercano o superior al reservado (${reservedVolume.toFixed(2)} m³).`,
      });
    }
  }

  // stacking: en un slot, si hay item no apilable en bottom y hay items en
  // middle/top, marcamos warning.
  for (const slot of loadPlan.palletSlots) {
    const bottom = slot.items.filter((i) => i.layer === "bottom");
    const upper = slot.items.filter((i) => i.layer !== "bottom");
    const enrichedBottom = bottom.map((b) =>
      assign.enrichedItems.find(
        (e) => e.placedSlotId === slot.slotId && e.item.productId === b.productId,
      ),
    );
    const fragileBottom = enrichedBottom.find(
      (e) => e?.item.stackable === false,
    );
    if (fragileBottom && upper.length > 0) {
      warnings.push({
        type: "stacking",
        severity: "info",
        message: `Item no apilable ${fragileBottom.item.name} en bottom de ${slot.slotId} con items encima.`,
        relatedSlotId: slot.slotId,
        relatedProductId: fragileBottom.item.productId,
      });
    }
  }

  // Suelo: warnings vacíos significa info "todo correcto".
  if (warnings.length === 0) {
    warnings.push({
      type: "missing_data",
      severity: "info",
      message: "Sin warnings: la asignación es coherente con la heurística actual.",
    });
  }

  return warnings;
}
