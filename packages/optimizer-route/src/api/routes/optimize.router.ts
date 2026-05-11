import { Router, Request, Response } from "express";
import { validateInput } from "../../validation/inputValidator";
import { optimizeRoute } from "../../optimizeRoute";
import { RoutePlan } from "../../types/output.types";

const router = Router();

const PLAN_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const planCache = new Map<string, { plan: RoutePlan; at: number }>();

function getLastPlan(): RoutePlan | null {
  const now = Date.now();
  // Purge stale entries
  for (const [key, entry] of planCache) {
    if (now - entry.at > PLAN_CACHE_TTL_MS) planCache.delete(key);
  }
  // Return most recent
  let newest: { plan: RoutePlan; at: number } | null = null;
  for (const entry of planCache.values()) {
    if (!newest || entry.at > newest.at) newest = entry;
  }
  return newest?.plan ?? null;
}

// POST /api/v1/optimize — recibe input.json, devuelve routePlan completo
router.post("/optimize", (req: Request, res: Response) => {
  const t0 = Date.now();
  const validation = validateInput(req.body);

  if (!validation.valid) {
    return res.status(400).json({ error: "Input inválido", details: validation.errors });
  }

  try {
    const plan = optimizeRoute(validation.data);
    planCache.set(plan.id, { plan, at: Date.now() });
    return res.json({ routePlan: plan, meta: { elapsedMs: Date.now() - t0 } });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/optimize/maps — devuelve waypoints listos para Google Maps Directions API
// Persona 5 llama esto y construye la URL de Google Maps directamente
router.get("/optimize/maps", (_req: Request, res: Response) => {
  const plan = getLastPlan();
  if (!plan) {
    return res.status(404).json({ error: "No hay ruta calculada. Llama primero a POST /optimize" });
  }

  // Origin y destination: el depósito
  const origin = `${plan.depot.lat},${plan.depot.lng}`;
  const destination = origin;

  // Waypoints: los puntos de APARCAMIENTO de cada parada (no la dirección exacta)
  // El camionero aparcar aquí y va a pie al cliente
  const waypoints = plan.stops.map((stop) => ({
    sequence:       stop.sequence,
    stopId:         stop.stopId,
    clientName:     stop.clientName,
    city:           stop.city,
    eta:            stop.eta.estimated,
    etaRange:       `${stop.eta.earliest}–${stop.eta.latest}`,
    // Punto de carga/descarga: donde para el camión
    parkingPoint: {
      lat:          stop.parkingPoint.lat,
      lng:          stop.parkingPoint.lng,
      name:         stop.parkingPoint.name,
      walkingMeters: stop.parkingPoint.walkingMeters,
      googleMapsLatLng: `${stop.parkingPoint.lat},${stop.parkingPoint.lng}`,
    },
    // Dirección exacta del cliente (a pie desde el parking)
    clientLocation: {
      lat:     stop.lat,
      lng:     stop.lng,
      address: stop.address,
    },
    timeWindow:    stop.timeWindow,
    paymentType:   stop.paymentType,
    collectionEur: stop.collectionAmountTotal > 0 ? stop.collectionAmountTotal : null,
    barrels:       plan.loadingOrder.find((l) => l.stopId === stop.stopId)?.barrels ?? 0,
    palletUnits:   stop.palletUnitsDelivered,
    reasoning:     stop.reasoning,
    clusterId:     stop.clusterId,
  }));

  // Agrupar por cluster para mostrar qué paradas comparten parking
  const clusterGroups = plan.clusters.map((cluster) => ({
    clusterId:        cluster.id,
    parkingPointName: cluster.parkingPointName,
    walkingMeters:    cluster.walkingMeters,
    stops:            cluster.stopIds.map((sid) => {
      const s = plan.stops.find((p) => p.stopId === sid);
      return { stopId: sid, clientName: s?.clientName, sequence: s?.sequence };
    }),
    reason: cluster.reason,
  }));

  // URL de Google Maps con todos los waypoints (máx 25 en API gratuita)
  // Persona 5 puede usar esta URL directamente en un <a> o en el SDK de Maps
  const GMAPS_MAX_WAYPOINTS = 23; // 25 total - origin - destination
  const waypointParam = waypoints
    .slice(0, Math.min(waypoints.length - 1, GMAPS_MAX_WAYPOINTS))
    .map((w) => `via:${w.parkingPoint.googleMapsLatLng}`)
    .join("|");

  const googleMapsDirectionsUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origin}` +
    `&destination=${destination}` +
    `&waypoints=${encodeURIComponent(waypointParam)}` +
    `&travelmode=driving`;

  // URL de Google Maps Embed (para iframe en el dashboard de Persona 5)
  const firstStop = waypoints[0];
  const googleMapsEmbedUrl = firstStop
    ? `https://www.google.com/maps/embed/v1/directions` +
      `?key=YOUR_GOOGLE_MAPS_API_KEY` +
      `&origin=${origin}` +
      `&destination=${destination}` +
      `&waypoints=${encodeURIComponent(waypointParam)}` +
      `&mode=driving`
    : null;

  return res.json({
    loadId:       plan.loadId,
    deliveryDate: plan.deliveryDate,
    driver:       plan.driver,
    vehicle:      plan.vehicle,
    depot: {
      name:   plan.depot.name,
      lat:    plan.depot.lat,
      lng:    plan.depot.lng,
      latlng: origin,
    },
    waypoints,
    clusterGroups,
    driverBreaks: plan.driverBreaks,
    loadingOrder: plan.loadingOrder,
    kpis:         plan.kpis,
    comparison:   plan.comparison,
    returnToDepotEta: plan.returnToDepotEta,
    googleMaps: {
      directionsUrl:  googleMapsDirectionsUrl,
      embedUrl:       googleMapsEmbedUrl,
      note: "Sustituir YOUR_GOOGLE_MAPS_API_KEY por la clave real de Persona 5",
    },
  });
});

export default router;
