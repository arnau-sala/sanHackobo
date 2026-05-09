import type { HandlingType, OrderItem, Unit } from "../types.js";

/**
 * Defaults de volumen (m³) y peso (kg) por unidad logística.
 * Calibrados con la hoja de carga real de DDI:
 *   - Barril 30L lleno ≈ 35 kg, ≈0.08 m³ con tanqueta.
 *   - Caja cerveza retornable 1/3 (24 botellines) ≈ 15 kg, ≈0.04 m³.
 *   - Botella suelta (licor 70cl) ≈ 1 kg, ≈0.005 m³.
 *   - Pack/cesta semicerrada ≈ 5 kg, ≈0.02 m³.
 *   - Tubo CO2 8 kg ≈ 10 kg, ≈0.06 m³.
 */
export const UNIT_DEFAULTS: Record<
  string,
  { volume: number; weight: number }
> = {
  Barril: { volume: 0.08, weight: 35 },
  Caja: { volume: 0.04, weight: 12 },
  Unidad: { volume: 0.01, weight: 2 },
  Botella: { volume: 0.005, weight: 1 },
  Pack: { volume: 0.02, weight: 5 },
  Tubo: { volume: 0.06, weight: 10 },
};

/**
 * Defaults adicionales según handlingType cuando la unidad es desconocida.
 */
export const HANDLING_DEFAULTS: Record<
  HandlingType,
  { volume: number; weight: number }
> = {
  keg: { volume: 0.08, weight: 35 },
  crate: { volume: 0.04, weight: 12 },
  box: { volume: 0.04, weight: 8 },
  bottle: { volume: 0.005, weight: 1 },
  unit: { volume: 0.01, weight: 2 },
  unknown: { volume: 0.02, weight: 5 },
};

function defaultsFor(unit: Unit, handling: HandlingType) {
  return UNIT_DEFAULTS[unit] ?? HANDLING_DEFAULTS[handling];
}

/** Volumen estimado por unidad de un item (m³). */
export function estimateUnitVolume(
  item: OrderItem,
  handling: HandlingType,
): { value: number; estimated: boolean } {
  if (typeof item.volume === "number" && item.volume > 0) {
    return { value: item.volume, estimated: false };
  }
  return { value: defaultsFor(item.unit, handling).volume, estimated: true };
}

/** Peso estimado por unidad de un item (kg). */
export function estimateUnitWeight(
  item: OrderItem,
  handling: HandlingType,
): { value: number; estimated: boolean } {
  if (typeof item.weight === "number" && item.weight > 0) {
    return { value: item.weight, estimated: false };
  }
  return { value: defaultsFor(item.unit, handling).weight, estimated: true };
}

/** Volumen total (cantidad * volumen unitario). */
export function estimateItemVolume(
  item: OrderItem,
  handling: HandlingType,
): number {
  return estimateUnitVolume(item, handling).value * Math.max(1, item.quantity);
}

/** Peso total (cantidad * peso unitario). */
export function estimateItemWeight(
  item: OrderItem,
  handling: HandlingType,
): number {
  return estimateUnitWeight(item, handling).value * Math.max(1, item.quantity);
}
