import type { InputPayload, Order, RoutePlan as OptimizerRoutePlan } from "@damm/optimizer-route";
import type {
  HandlingType,
  InputData,
  RouteCluster,
  RoutePlan as LoadRoutePlan,
  RouteStop,
  Unit,
  Vehicle as LoadVehicle,
} from "@damm/optimizer-load";

function mapHandling(ht: string): HandlingType {
  switch (ht) {
    case "crate":
      return "crate";
    case "barrel":
      return "keg";
    case "pack":
      return "box";
    case "unit":
      return "unit";
    default:
      return "unknown";
  }
}

function normalizeVehicleType(routeType: string): LoadVehicle["type"] {
  if (routeType.includes("8_pallet")) return "8_pallet_truck";
  if (routeType.includes("6_pallet")) return "6_pallet_truck";
  return "3_pallet_van";
}

export function inputPayloadToLoadInputData(payload: InputPayload): InputData {
  return {
    depot: {
      id: payload.depot.id,
      name: payload.depot.name,
      lat: payload.depot.lat,
      lng: payload.depot.lng,
    },
    vehicle: {
      id: payload.vehicle.id,
      type: normalizeVehicleType(payload.vehicle.type),
      palletSlots: payload.vehicle.palletSlots,
      access: payload.vehicle.access,
    },
    driver: payload.driver,
    stops: payload.stops.map((s) => ({
      id: s.id,
      clientId: s.clientId,
      clientName: s.clientName,
      address: s.address,
      zone: s.zone,
      route: s.route,
      lat: s.lat,
      lng: s.lng,
      timeWindow: s.timeWindow,
      historicalConfidence: s.historicalConfidence,
      orders: s.orderIds,
    })),
    orders: payload.orders.map((o: Order) => ({
      id: o.id,
      stopId: o.stopId,
      paymentType: undefined,
      items: o.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit as Unit,
        volume: item.volume_L,
        weight: item.weight_kg,
        returnable: item.returnable,
        warehouseLocation: item.warehouseLocation,
        handlingType: mapHandling(item.handlingType),
      })),
    })),
  };
}

export function optimizerRoutePlanToLoadRoutePlan(
  plan: OptimizerRoutePlan,
): LoadRoutePlan {
  const clusters: RouteCluster[] | undefined = plan.clusters?.map((c) => ({
    id: c.id,
    stopIds: c.stopIds,
    parkingPointName: c.parkingPointName,
    walkingMeters: c.walkingMeters,
    reason: c.reason,
  }));

  const stops: RouteStop[] = plan.stops.map((s) => ({
    sequence: s.sequence,
    stopId: s.stopId,
    clusterId: s.clusterId,
    clientName: s.clientName,
    arrivalEta: s.eta?.estimated,
    serviceMinutes: s.serviceMinutes,
    reasoning: s.reasoning.map((r) => r.text),
  }));

  return {
    id: plan.id,
    totalStops: plan.stops.length,
    estimatedKm: plan.kpis.totalDistanceKm,
    estimatedMinutes:
      plan.kpis.totalDriveMinutes +
      plan.kpis.totalServiceMinutes +
      plan.kpis.totalWaitMinutes,
    stops,
    clusters,
  };
}
