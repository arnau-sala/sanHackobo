import type {
  AccessPriority,
  BuildTruckLayoutOptions,
  PalletSlot,
  Side,
  Vehicle,
} from "../types.js";

/**
 * Construye el layout lógico del camión a partir del vehículo.
 *
 * Devuelve una lista ordenada de slots P1..Pn con side, accessPriority y
 * capacidad. La estrategia es la documentada en el README:
 *
 *   8 palets:
 *     P1 right high      P2 right high       P3 left  high
 *     P4 left  medium    P5 right medium     P6 left  medium
 *     P7 rear  low       P8 rear  returnables
 *
 *   6 palets:
 *     P1 right high      P2 right high       P3 left medium
 *     P4 left  medium    P5 rear  low        P6 rear returnables
 *
 *   3 palets (van):
 *     P1 right high      P2 left  medium     P3 rear returnables
 */
export function buildTruckLayout(
  vehicle: Vehicle,
  opts: BuildTruckLayoutOptions = {},
): PalletSlot[] {
  const palletVolume = opts.palletVolume ?? 1.6; // m³ útiles por palet
  const palletWeight = opts.palletWeight ?? 750; // kg

  const n = vehicle.palletSlots;
  const blueprint = blueprintFor(vehicle.type, n);

  return blueprint.map((b, i) => ({
    slotId: `P${i + 1}`,
    side: b.side,
    accessPriority: b.accessPriority,
    reservedFor: b.accessPriority === "returnables" ? "returnables" : "delivery",
    capacityVolume: vehicle.maxVolume
      ? vehicle.maxVolume / n
      : palletVolume,
    capacityWeight: vehicle.maxWeight
      ? vehicle.maxWeight / n
      : palletWeight,
    usedVolume: 0,
    usedWeight: 0,
    fillRatio: 0,
    items: [],
  }));
}

interface SlotBlueprint {
  side: Side;
  accessPriority: AccessPriority;
}

function blueprintFor(type: Vehicle["type"], n: number): SlotBlueprint[] {
  if (type === "8_pallet_truck" || n === 8) {
    return [
      { side: "right", accessPriority: "high" },
      { side: "right", accessPriority: "high" },
      { side: "left", accessPriority: "high" },
      { side: "left", accessPriority: "medium" },
      { side: "right", accessPriority: "medium" },
      { side: "left", accessPriority: "medium" },
      { side: "rear", accessPriority: "low" },
      { side: "rear", accessPriority: "returnables" },
    ];
  }
  if (type === "6_pallet_truck" || n === 6) {
    return [
      { side: "right", accessPriority: "high" },
      { side: "right", accessPriority: "high" },
      { side: "left", accessPriority: "medium" },
      { side: "left", accessPriority: "medium" },
      { side: "rear", accessPriority: "low" },
      { side: "rear", accessPriority: "returnables" },
    ];
  }
  if (type === "3_pallet_van" || n === 3) {
    return [
      { side: "right", accessPriority: "high" },
      { side: "left", accessPriority: "medium" },
      { side: "rear", accessPriority: "returnables" },
    ];
  }

  // Fallback genérico: alterna right/left, último slot retornables.
  const slots: SlotBlueprint[] = [];
  for (let i = 0; i < n - 1; i++) {
    const side: Side = i % 2 === 0 ? "right" : "left";
    const accessPriority: AccessPriority =
      i < n / 3 ? "high" : i < (2 * n) / 3 ? "medium" : "low";
    slots.push({ side, accessPriority });
  }
  slots.push({ side: "rear", accessPriority: "returnables" });
  return slots;
}

/**
 * Devuelve el rank numérico de una accessPriority. Sirve para ordenar slots
 * por accesibilidad y calcular el routeAlignmentScore.
 *   high=0 (mejor), medium=1, low=2, returnables=3 (no entra en delivery).
 */
export function accessRank(p: AccessPriority): number {
  switch (p) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    case "returnables":
      return 3;
  }
}
