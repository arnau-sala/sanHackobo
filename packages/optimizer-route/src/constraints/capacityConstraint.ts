import { VehicleState } from "../types/internal.types";
import { EnrichedStop } from "../types/internal.types";
import { PALLET_UNITS_PER_SLOT } from "../types/input.types";

export interface CapacityFeasibility {
  feasible: boolean;
  usedAfter: number;
  maxUnits: number;
  reason?: string;
}

export function checkCapacity(
  vehicleState: VehicleState,
  candidate: EnrichedStop
): CapacityFeasibility {
  // Al entregar esta parada, liberamos sus palletUnits y cargamos los retornables
  // Los retornables ocupan: barriles vacíos = 4 palletUnits, cajas vacías = 1 palletUnit
  // Pero como acabamos de entregar, la capacidad neta es:
  //   usedPalletUnits - delivered + returnablesPalletUnits
  const returnablesPalletUnits = candidate.returnablesCount; // simplificado: 1 por retornable
  const netChange = -candidate.totalPalletUnits + returnablesPalletUnits;
  const usedAfter = vehicleState.usedPalletUnits + netChange;

  if (usedAfter < 0) {
    // No debería pasar, pero protegemos
    return { feasible: true, usedAfter: 0, maxUnits: vehicleState.maxPalletUnits };
  }

  // El camión siempre puede entregar (reduce carga), pero si los retornables
  // superan la capacidad tras la entrega, lo marcamos como advertencia (no bloqueante)
  const feasible = usedAfter <= vehicleState.maxPalletUnits;
  return {
    feasible,
    usedAfter,
    maxUnits: vehicleState.maxPalletUnits,
    reason: feasible ? undefined : `Retornables superan capacidad (${usedAfter}/${vehicleState.maxPalletUnits} pu)`,
  };
}

export function totalPalletUnits(palletSlots: number): number {
  return palletSlots * PALLET_UNITS_PER_SLOT;
}
