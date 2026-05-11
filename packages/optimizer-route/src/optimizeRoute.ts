import { InputPayload, Order, Stop, PALLET_UNITS_PER_SLOT } from "./types/input.types";
import { RoutePlan, PlannedStop, DriverBreak, LoadingInstruction, PlannedStopOrder } from "./types/output.types";
import { EnrichedStop, VehicleState, DriverState, ScoringWeights, CandidateScore } from "./types/internal.types";
import { haversineDistance, timeToMin, minToTime } from "./geo/haversine";
import { estimateTravelMinutes } from "./geo/travelTime";
import { clusterStops } from "./geo/clustering";
import { checkTimeWindow } from "./constraints/timeWindowConstraint";
import { checkCapacity, totalPalletUnits } from "./constraints/capacityConstraint";
import { checkDriverCompliance } from "./constraints/driverHoursConstraint";
import { scoreStop, DEFAULT_WEIGHTS } from "./scoring/scorer";
import { generateReasoning } from "./scoring/reasoning";
import { parkingPointsCached } from "./data/geocoder";

const SERVICE_MIN_BASE   = 10; // minutos base por parada
const SERVICE_MIN_BARREL =  5; // minutos extra por cada barril

function serviceMinutes(es: EnrichedStop): number {
  return SERVICE_MIN_BASE + es.barrelCount * SERVICE_MIN_BARREL;
}

// Construye el objeto EnrichedStop uniendo Stop con sus Orders
function enrichStop(stop: Stop, orderMap: Map<string, Order>): EnrichedStop {
  const orders = stop.orderIds.map((id) => orderMap.get(id)!).filter(Boolean);
  let totalPalletUnitsVal = 0;
  let totalWeightKg = 0;
  let totalVolumeL = 0;
  let returnablesCount = 0;
  let barrelCount = 0;
  let crateCount = 0;
  const warehouseLocations: string[] = [];

  for (const order of orders) {
    // Envases vacíos a recoger (no ocupan espacio de salida, se recogen in situ)
    returnablesCount += order.emptyContainersToPickup ?? 0;
    for (const item of order.items) {
      totalPalletUnitsVal += item.palletUnitsTotal;
      totalWeightKg       += item.weight_kg * item.quantity;
      totalVolumeL        += item.volume_L  * item.quantity;
      if (item.handlingType === "barrel") barrelCount += item.quantity;
      else if (item.handlingType === "crate") crateCount += item.quantity;
      if (!warehouseLocations.includes(item.warehouseLocation)) {
        warehouseLocations.push(item.warehouseLocation);
      }
    }
  }

  const collectionAmount = orders.reduce((sum, o) => sum + o.collectionAmount, 0);

  return {
    stop,
    orders,
    totalPalletUnits: totalPalletUnitsVal,
    totalWeightKg,
    totalVolumeL,
    returnablesCount,
    barrelCount,
    crateCount,
    collectionAmount,
    warehouseLocations,
  };
}

// Baseline: orden secuencial del input tal como lo genera el sistema DR de Damm.
// Simula la jornada completa igual que el optimizador (con esperas en ventana)
// para que la comparativa sea honesta.
function computeBaseline(enrichedStops: EnrichedStop[], depot: InputPayload["depot"]): { km: number; min: number } {
  let lat = depot.lat, lng = depot.lng;
  let km = 0;
  let currentTime = 7 * 60; // 07:00

  for (const es of enrichedStops) {
    const distM = haversineDistance(lat, lng, es.stop.lat, es.stop.lng);
    const driveMin = estimateTravelMinutes(distM, currentTime, "rural");
    km += distM / 1000;
    currentTime += driveMin;

    const open = timeToMin(es.stop.timeWindow.from);
    if (currentTime < open) currentTime = open;

    currentTime += serviceMinutes(es);
    lat = es.stop.lat;
    lng = es.stop.lng;
  }

  // Incluir retorno al depósito para comparativa justa
  const returnDistM = haversineDistance(lat, lng, depot.lat, depot.lng);
  km += returnDistM / 1000;
  currentTime += estimateTravelMinutes(returnDistM, currentTime, "rural");

  return { km, min: currentTime - 7 * 60 };
}

export function optimizeRoute(input: InputPayload, weights: ScoringWeights = DEFAULT_WEIGHTS): RoutePlan {
  const t0 = Date.now();
  const { depot, vehicle, driver, stops, orders } = input;

  // Indexar orders por id
  const orderMap = new Map<string, Order>(orders.map((o) => [o.id, o]));

  // Enriquecer paradas
  const enrichedStops: EnrichedStop[] = stops.map((s) => enrichStop(s, orderMap));

  // Clustering
  const { clusters, stopToCluster } = clusterStops(enrichedStops);

  // Enriquecer nombres de parking desde caché (resueltos por geocodeTransporte)
  const parkingNames = parkingPointsCached(
    clusters.map((c) => ({
      id: c.id,
      centroidLat: c.centroidLat,
      centroidLng: c.centroidLng,
      stopCount: c.stopIds.length,
      city: enrichedStops.find((e) => e.stop.id === c.stopIds[0])?.stop.city ?? "",
    }))
  );
  for (const c of clusters) {
    const resolved = parkingNames.get(c.id);
    if (resolved) c.parkingPointName = resolved;
  }

  // Capacidad del vehículo
  const maxPalletUnits = totalPalletUnits(vehicle.palletSlots);

  // Calcular totalPalletUnits de carga inicial
  const initialPalletUnits = enrichedStops.reduce((s, es) => s + es.totalPalletUnits, 0);

  // Estado inicial del vehículo: cargado con todo
  const vehicleState: VehicleState = {
    usedPalletUnits: initialPalletUnits,
    maxPalletUnits,
    returnablesOnBoard: 0,
    currentLat: depot.lat,
    currentLng: depot.lng,
    loadedStopIds: [],
  };

  const driverState: DriverState = {
    continuousDriveMin: driver.continuousDriveAlreadyMin ?? 0,
    totalDriveMin: driver.totalDriveAlreadyTodayMin ?? 0,
    totalWorkMin: 0,
    lastBreakAtMin: 0,
  };

  const START_MIN = timeToMin(driver.shiftStartTime ?? "07:00");
  const maxDistance = Math.max(
    ...enrichedStops.map((es) => haversineDistance(depot.lat, depot.lng, es.stop.lat, es.stop.lng))
  ) * 1.5 || 1;

  const remaining: EnrichedStop[] = [...enrichedStops];
  const planned: PlannedStop[] = [];
  const driverBreaks: DriverBreak[] = [];
  const skippedStops: Array<{ stopId: string; clientName: string; reason: string }> = [];

  let currentLat = depot.lat;
  let currentLng = depot.lng;
  let currentTime = START_MIN;
  let currentClusterId: string | null = null;
  let totalKm = 0;
  let windowAdherenceCount = 0;

  while (remaining.length > 0) {
    // Verificar si el conductor necesita pausa
    const compliance = checkDriverCompliance(
      driverState.continuousDriveMin,
      driverState.totalDriveMin,
      driverState.totalWorkMin,
      START_MIN
    );

    if (compliance.mustBreakNow && planned.length > 0) {
      driverBreaks.push({
        afterSequence: planned.length,
        durationMin: compliance.breakDurationMin,
        regulationRef: "EU_REG_561_2006_4H30",
      });
      currentTime += compliance.breakDurationMin;
      driverState.continuousDriveMin = 0;
      driverState.lastBreakAtMin = currentTime;
    }

    // Evaluar todos los candidatos restantes
    const candidates: CandidateScore[] = remaining.map((es): CandidateScore => {
      const ctx = {
        currentLat, currentLng, currentTimeMinutes: currentTime,
        currentClusterId, stopToCluster, maxDistance, vehicleState, driverState,
      };
      const scored = scoreStop(es, ctx, weights);
      const windowCheck = checkTimeWindow(scored.projectedArrivalMin, es.stop.timeWindow);
      const capCheck = checkCapacity(vehicleState, es);

      const feasible = windowCheck.feasible;
      let infeasibilityReason: string | undefined;
      if (!windowCheck.feasible) {
        infeasibilityReason = `Ventana cerrada a las ${es.stop.timeWindow.to} — llegaría a las ${minToTime(scored.projectedArrivalMin)}`;
      }

      return {
        enrichedStop: es,
        totalScore: feasible ? scored.totalScore : -1,
        breakdown: scored.breakdown,
        feasible,
        infeasibilityReason,
        projectedArrivalMin: windowCheck.effectiveArrivalMin,
        projectedDriveMin: scored.projectedDriveMin,
        projectedDistM: scored.projectedDistM,
      };
    });

    // Separar factibles de no-factibles
    const feasible = candidates.filter((c) => c.feasible);

    if (feasible.length === 0) {
      // Todas las paradas restantes son inviables — registrar y salir
      for (const c of candidates) {
        skippedStops.push({
          stopId: c.enrichedStop.stop.id,
          clientName: c.enrichedStop.stop.clientName,
          reason: c.infeasibilityReason ?? "No factible",
        });
      }
      break;
    }

    // Elegir el candidato con mayor score
    feasible.sort((a, b) => b.totalScore - a.totalScore);
    const winner = feasible[0];
    const es = winner.enrichedStop;

    const windowCheck = checkTimeWindow(winner.projectedArrivalMin - winner.projectedDriveMin + winner.projectedDriveMin, es.stop.timeWindow);
    const waitMin = windowCheck.waitMinutes;
    const arrivalMin = winner.projectedArrivalMin;
    const clusterId = stopToCluster.get(es.stop.id) ?? "cluster_00";
    const cluster = clusters.find((c) => c.id === clusterId)!;
    const isFirstInCluster = currentClusterId !== clusterId;
    const svcMin = serviceMinutes(es);

    const etaConfidence = Math.round(es.stop.historicalConfidence * 100);
    const etaBuffer = Math.round((1 - es.stop.historicalConfidence) * 20);

    // Construir orders para el output
    const plannedOrders: PlannedStopOrder[] = es.orders.map((o) => ({
      orderId: o.id,
      documentId: o.documentId,
      items: o.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        palletUnitsTotal: it.palletUnitsTotal,
      })),
      collectionAmount: o.collectionAmount,
      totalAmount: o.totalAmount,
    }));

    // Actualizar estados
    vehicleState.usedPalletUnits  = Math.max(0, vehicleState.usedPalletUnits - es.totalPalletUnits);
    vehicleState.returnablesOnBoard += es.returnablesCount;
    vehicleState.currentLat = es.stop.lat;
    vehicleState.currentLng = es.stop.lng;
    vehicleState.loadedStopIds.push(es.stop.id);
    driverState.continuousDriveMin += winner.projectedDriveMin;
    driverState.totalDriveMin      += winner.projectedDriveMin;
    driverState.totalWorkMin       += winner.projectedDriveMin + waitMin + svcMin;

    const wasInWindow = arrivalMin <= timeToMin(es.stop.timeWindow.to);
    if (wasInWindow) windowAdherenceCount++;

    planned.push({
      sequence: planned.length + 1,
      stopId: es.stop.id,
      clusterId,
      clientId: es.stop.clientId,
      clientName: es.stop.clientName,
      address: es.stop.address,
      city: es.stop.city,
      lat: es.stop.lat,
      lng: es.stop.lng,
      timeWindow: es.stop.timeWindow,
      paymentType: es.stop.paymentType,
      eta: {
        estimated: minToTime(arrivalMin),
        earliest: minToTime(Math.max(arrivalMin - etaBuffer, timeToMin(es.stop.timeWindow.from))),
        latest: minToTime(Math.min(arrivalMin + etaBuffer, timeToMin(es.stop.timeWindow.to))),
        confidencePct: etaConfidence,
      },
      waitMinutes: Math.round(waitMin),
      serviceMinutes: svcMin,
      driveDistanceM: Math.round(winner.projectedDistM),
      driveMinutes: Math.round(winner.projectedDriveMin),
      parkingPoint: {
        name: cluster.parkingPointName,
        lat: cluster.centroidLat,
        lng: cluster.centroidLng,
        walkingMeters: Math.round(cluster.walkingMeters),
      },
      orders: plannedOrders,
      collectionAmountTotal: es.collectionAmount,
      palletUnitsDelivered: es.totalPalletUnits,
      returnablesToPickup: es.returnablesCount,
      vehicleStateAfter: {
        usedPalletUnits: vehicleState.usedPalletUnits,
        totalPalletUnits: maxPalletUnits,
        occupancyPct: Math.round((vehicleState.usedPalletUnits / maxPalletUnits) * 100),
        returnablesOnBoard: vehicleState.returnablesOnBoard,
      },
      reasoning: generateReasoning(es, winner.breakdown, isFirstInCluster, arrivalMin, Math.round(waitMin)),
      scoreDebug: {
        total:           Math.round(winner.totalScore * 1000) / 1000,
        proximity:       Math.round(winner.breakdown.proximity * 1000) / 1000,
        urgency:         Math.round(winner.breakdown.urgency * 1000) / 1000,
        confidence:      Math.round(winner.breakdown.confidence * 1000) / 1000,
        cohesion:        Math.round(winner.breakdown.cohesion * 1000) / 1000,
        paymentPriority: Math.round(winner.breakdown.paymentPriority * 1000) / 1000,
        capacityImpact:  Math.round(winner.breakdown.capacityImpact * 1000) / 1000,
      },
    });

    totalKm += winner.projectedDistM / 1000;
    currentTime = arrivalMin + svcMin;
    currentLat = es.stop.lat;
    currentLng = es.stop.lng;
    currentClusterId = clusterId;
    remaining.splice(remaining.indexOf(es), 1);
  }

  // Retorno al depósito
  const returnDistM = haversineDistance(currentLat, currentLng, depot.lat, depot.lng);
  const returnDriveMin = estimateTravelMinutes(returnDistM, currentTime, "rural");
  const returnEtaMin = currentTime + returnDriveMin;
  totalKm += returnDistM / 1000;

  // Orden de carga LIFO: invertir el orden de entrega
  const loadingOrder: LoadingInstruction[] = [...planned]
    .reverse()
    .map((p, i) => {
      const es = enrichedStops.find((e) => e.stop.id === p.stopId)!;
      return {
        loadingPosition: i + 1,
        stopId: p.stopId,
        clientName: p.clientName,
        palletUnits: p.palletUnitsDelivered,
        barrels: es.barrelCount,
        crates: es.crateCount,
        warehouseLocations: es.warehouseLocations.sort(),
        note: es.barrelCount > 0
          ? `${es.barrelCount} barril(es) — colocar al fondo, usar transpaleta`
          : "Cajas — colocar accesibles",
      };
    });

  // KPIs
  const totalDriveMin = planned.reduce((s, p) => s + p.driveMinutes, 0);
  const totalServiceMin = planned.reduce((s, p) => s + p.serviceMinutes, 0);
  const totalWaitMin = planned.reduce((s, p) => s + p.waitMinutes, 0);
  const totalCollection = planned.reduce((s, p) => s + p.collectionAmountTotal, 0);
  const totalReturnables = planned.reduce((s, p) => s + p.returnablesToPickup, 0);
  const routeAdherencePct = planned.length > 0
    ? Math.round((windowAdherenceCount / planned.length) * 100)
    : 0;

  const baseline = computeBaseline(enrichedStops, depot);
  const estimatedMinutes = totalDriveMin + totalServiceMin + totalWaitMin;

  const etaReturnBuffer = 5;
  return {
    id: `route_plan_${input.loadId}_${Date.now()}`,
    loadId: input.loadId,
    generatedAt: new Date().toISOString(),
    deliveryDate: input.deliveryDate,
    algorithm: "greedy_multi_objective_v1",
    depot: { id: depot.id, name: depot.name, lat: depot.lat, lng: depot.lng },
    driver: { id: driver.id, name: driver.name },
    vehicle: { id: vehicle.id, plate: vehicle.plate, palletSlots: vehicle.palletSlots, totalPalletUnits: maxPalletUnits },
    stops: planned,
    driverBreaks,
    loadingOrder,
    clusters,
    kpis: {
      totalDistanceKm:      Math.round(totalKm * 10) / 10,
      totalDriveMinutes:    Math.round(totalDriveMin),
      totalServiceMinutes:  Math.round(totalServiceMin),
      totalWaitMinutes:     Math.round(totalWaitMin),
      totalCollectionEur:   Math.round(totalCollection * 100) / 100,
      palletOccupancyPct:   input._summary?.occupancyPct ?? Math.round((initialPalletUnits / maxPalletUnits) * 100),
      returnablesTotalPickup: totalReturnables,
      skippedStops,
      routeAdherencePct,
    },
    comparison: {
      baseline: {
        km: Math.round(baseline.km * 10) / 10,
        minutes: Math.round(baseline.min),
        description: "Orden original del input (ruta DR sin optimizar)",
      },
      optimized: {
        km: Math.round(totalKm * 10) / 10,
        minutes: Math.round(estimatedMinutes),
        description: "Orden recomendado por scoring multi-objetivo",
      },
      savings: {
        km:      Math.round((baseline.km - totalKm) * 10) / 10,
        minutes: Math.round(baseline.min - estimatedMinutes),
        percentage: baseline.km > 0
          ? Math.round((1 - totalKm / baseline.km) * 100)
          : 0,
      },
    },
    returnToDepotEta: {
      estimated: minToTime(returnEtaMin),
      earliest:  minToTime(returnEtaMin - etaReturnBuffer),
      latest:    minToTime(returnEtaMin + etaReturnBuffer),
      confidencePct: 90,
    },
    meta: {
      solveMs: Date.now() - t0,
      stopsRequested: stops.length,
      stopsPlanned: planned.length,
      stopsSkipped: skippedStops.length,
      ordersTotal: orders.length,
    },
  };
}
