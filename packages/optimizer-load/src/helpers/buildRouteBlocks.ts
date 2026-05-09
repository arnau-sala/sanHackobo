import type { PalletSlot, RouteBlock, RoutePlan } from "../types.js";
import { accessRank } from "./buildTruckLayout.js";

/**
 * Divide la ruta en bloques contiguos de paradas y reparte los slots de
 * delivery entre los bloques en orden de accesibilidad.
 *
 *   - Los slots con accessPriority='high' se asignan a los bloques iniciales.
 *   - Los slots 'medium' a los bloques medios.
 *   - Los slots 'low' a los bloques finales.
 *   - Los slots 'returnables' nunca se asignan a un bloque de delivery.
 *
 * @param routePlan Plan de ruta ordenado.
 * @param slots Slots del camión (de buildTruckLayout).
 * @param blockSize Número de paradas por bloque (default 4).
 */
export function buildRouteBlocks(
  routePlan: RoutePlan,
  slots: PalletSlot[],
  blockSize = 4,
): RouteBlock[] {
  const sorted = [...routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  if (sorted.length === 0) return [];

  const totalStops = sorted.length;
  const blockCount = Math.max(1, Math.ceil(totalStops / blockSize));
  const blockNames = ["A", "B", "C", "D", "E", "F", "G", "H"];

  // 1. Construir bloques con su rango y stopIds.
  const blocks: RouteBlock[] = [];
  for (let b = 0; b < blockCount; b++) {
    const startIdx = b * blockSize;
    const endIdx = Math.min(startIdx + blockSize, totalStops);
    const slice = sorted.slice(startIdx, endIdx);
    const from = slice[0]?.sequence ?? startIdx + 1;
    const to = slice[slice.length - 1]?.sequence ?? endIdx;
    blocks.push({
      id: `block-${blockNames[b] ?? b + 1}`,
      name: `Bloque ${blockNames[b] ?? b + 1}`,
      sequenceRange: { from, to },
      stopIds: slice.map((s) => s.stopId),
      assignedSlots: [],
      strategy: "hybrid_by_route_blocks",
    });
  }

  // 2. Repartir slots de delivery (no returnables) entre los bloques.
  //    - Slots ordenados por accesibilidad (high → medium → low).
  //    - Distribución balanceada: floor(n/blocks) slots base y los extras
  //      van a los primeros bloques (cargas iniciales son más pesadas y
  //      llevan más cervezas/barriles).
  //    - Resultado típico con 7 slots de delivery y 4 bloques:
  //        Block A → 2 slots (P1, P2)   acceso high
  //        Block B → 2 slots (P3, P4)   acceso high/medium
  //        Block C → 2 slots (P5, P6)   acceso medium/medium
  //        Block D → 1 slot  (P7)       acceso low
  const deliverySlots = slots
    .filter((s) => s.accessPriority !== "returnables")
    .slice()
    .sort((a, b) => accessRank(a.accessPriority) - accessRank(b.accessPriority));

  const slotsPerBlockBase = Math.floor(deliverySlots.length / blocks.length);
  const extras = deliverySlots.length - slotsPerBlockBase * blocks.length;

  let cursor = 0;
  for (let b = 0; b < blocks.length; b++) {
    const count = slotsPerBlockBase + (b < extras ? 1 : 0);
    for (let k = 0; k < count && cursor < deliverySlots.length; k++) {
      blocks[b].assignedSlots.push(deliverySlots[cursor].slotId);
      cursor++;
    }
  }

  // 3. Si algún bloque ha quedado sin slot (caso raro: más bloques que
  //    slots), comparte slot con el siguiente bloque.
  for (let b = 0; b < blocks.length; b++) {
    if (blocks[b].assignedSlots.length === 0) {
      const neighbor = blocks[b + 1] ?? blocks[b - 1];
      if (neighbor && neighbor.assignedSlots.length > 0) {
        blocks[b].assignedSlots.push(neighbor.assignedSlots[0]);
      }
    }
  }

  return blocks;
}
