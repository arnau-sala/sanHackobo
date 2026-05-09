/**
 * Versión mínima de enrichStop para poder hacer clustering desde scripts externos
 * sin instanciar el optimizador completo.
 */
import { InputPayload, Order } from "../types/input.types";
import { EnrichedStop } from "../types/internal.types";

export function enrichStopsForClustering(input: InputPayload): EnrichedStop[] {
  const orderMap = new Map<string, Order>(input.orders.map((o) => [o.id, o]));

  return input.stops.map((stop) => {
    const orders = stop.orderIds.map((id) => orderMap.get(id)!).filter(Boolean);
    let totalPalletUnits = 0;
    let barrelCount = 0;
    let crateCount = 0;
    let returnablesCount = 0;
    let totalWeightKg = 0;
    let totalVolumeL = 0;
    const warehouseLocations: string[] = [];
    let collectionAmount = 0;

    for (const order of orders) {
      collectionAmount += order.collectionAmount;
      for (const item of order.items) {
        totalPalletUnits += item.palletUnitsTotal;
        totalWeightKg    += item.weight_kg * item.quantity;
        totalVolumeL     += item.volume_L  * item.quantity;
        if (item.returnable)                returnablesCount += item.quantity;
        if (item.handlingType === "barrel") barrelCount      += item.quantity;
        else                                crateCount       += item.quantity;
        if (!warehouseLocations.includes(item.warehouseLocation)) {
          warehouseLocations.push(item.warehouseLocation);
        }
      }
    }

    return {
      stop, orders, totalPalletUnits, totalWeightKg, totalVolumeL,
      barrelCount, crateCount, returnablesCount, collectionAmount, warehouseLocations,
    };
  });
}
