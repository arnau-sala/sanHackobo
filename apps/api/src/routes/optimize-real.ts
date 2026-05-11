/**
 * POST /api/optimize/real
 *
 * Body: { transportId: number }
 *
 * Lee routes-history.json, convierte el transporte a InputPayload compatible
 * con optimizer-route, ejecuta optimizeRoute() y devuelve el plan completo.
 */
import { readFile } from "fs/promises";
import { resolve } from "path";
import { optimizeRoute } from "@damm/optimizer-route";
import { optimizeLoad } from "@damm/optimizer-load";
import type { HandlerResult } from "./optimize-load.js";
import type {
  InputPayload,
  Stop,
  Order,
  OrderItem,
} from "@damm/optimizer-route";

const PROCESSED = resolve(process.cwd(), "data/processed");

let _routesCache: any[] | null = null;
let _materialsCache: any[] | null = null;

async function loadRoutes(): Promise<any[]> {
  if (_routesCache) return _routesCache;
  const txt = await readFile(`${PROCESSED}/routes-history.json`, "utf8");
  _routesCache = JSON.parse(txt);
  return _routesCache!;
}

async function loadMaterials(): Promise<Map<string, any>> {
  if (_materialsCache) {
    return new Map(_materialsCache.map((m: any) => [m.materialId, m]));
  }
  const txt = await readFile(`${PROCESSED}/materials-enriched.json`, "utf8");
  _materialsCache = JSON.parse(txt);
  return new Map(_materialsCache!.map((m: any) => [m.materialId, m]));
}

// Palletunit estimates por tipo de handling
function palletUnitsEach(handlingType: string): number {
  if (handlingType === "keg") return 4;
  if (handlingType === "crate") return 1;
  return 1;
}

function mapUnit(u: string): string {
  const m: Record<string, string> = { CAJ: "Caja", BAR: "Barril", UN: "Unidad", UNI: "Unidad", PAL: "Palet" };
  return m[u.toUpperCase()] ?? u;
}

// Inferir tipo de pago por nombre de cliente (heurística básica)
function paymentType(clientName: string): "CONTADO" | "CREDITO" {
  const n = clientName.toUpperCase();
  if (n.includes("BAR") || n.includes("CAFET") || n.includes("RESTAUR")) return "CONTADO";
  return "CREDITO";
}

function timeWindowDefault(city: string): { from: string; to: string } {
  return { from: "08:00", to: "14:00" };
}

// Convierte un transporte del historial al InputPayload de optimizer-route
async function transportToInputPayload(transport: any, materials: Map<string, any>): Promise<InputPayload> {
  const stops: Stop[] = [];
  const orders: Order[] = [];

  for (const stop of transport.stops) {
    const lat = typeof stop.lat === "number" && stop.lat !== 0 ? stop.lat : null;
    const lng = typeof stop.lng === "number" && stop.lng !== 0 ? stop.lng : null;

    if (!lat || !lng) continue; // solo stops geocodificados

    const orderItems: OrderItem[] = stop.items.map((item: any) => {
      const mat = materials.get(item.material) ?? {};
      const ht = mat.handlingType ?? "box";
      const pue = palletUnitsEach(ht);
      const qty = Number(item.cantidad) || 1;

      return {
        productId: item.material,
        name: item.descripcion,
        quantity: qty,
        unit: mapUnit(item.unidad),
        volume_L: (mat.dimensions?.lengthCm ?? 40) * (mat.dimensions?.widthCm ?? 30) * (mat.dimensions?.heightCm ?? 25) / 1000,
        weight_kg: (mat.dimensions?.weightKg ?? 10) / Math.max(mat.dimensions?.unitsPerBox ?? 1, 1),
        returnable: mat.returnable ?? false,
        warehouseLocation: mat.warehouseLocation ?? "—",
        handlingType: ht === "keg" ? "barrel" : ht === "crate" ? "crate" : "pack",
        palletUnitsEach: pue,
        palletUnitsTotal: pue * qty,
        palletUnits: pue * qty,
      };
    });

    const orderId = `order-${stop.deliveryId}`;
    const stopId = stop.stopId;

    stops.push({
      id: stopId,
      clientId: String(stop.clientId),
      clientName: stop.clientName,
      address: stop.address,
      city: stop.city,
      postalCode: stop.cp,
      zone: transport.route,
      route: transport.route,
      lat,
      lng,
      timeWindow: timeWindowDefault(stop.city),
      paymentType: paymentType(stop.clientName),
      historicalConfidence: 0.8,
      orderIds: [orderId],
    });

    orders.push({
      id: orderId,
      stopId,
      documentId: String(stop.deliveryId),
      items: orderItems,
      emptyContainersToPickup: orderItems.filter(i => i.returnable).reduce((s, i) => s + i.quantity, 0),
      totalAmount: 0,
      collectionAmount: paymentType(stop.clientName) === "CONTADO" ? orderItems.reduce((s, i) => s + i.quantity * 5, 0) : 0,
    });
  }

  return {
    loadId: `load-${transport.transportId}`,
    deliveryDate: transport.date,
    depot: {
      id: "mollet",
      name: "DDI Mollet",
      lat: 41.5390,
      lng: 2.2130,
      address: "Carrer de Montcada, 08100 Mollet del Vallès",
    },
    vehicle: {
      id: "V235045",
      plate: "V235045",
      type: "8_pallet_truck",
      palletSlots: 8,
      access: ["left", "right", "rear"],
    },
    driver: {
      id: String(transport.driverId),
      name: transport.driverName,
      shiftStartTime: "07:00",
    },
    stops,
    orders,
    _summary: {
      totalStops: stops.length,
      totalOrders: orders.length,
      totalPalletUnits: orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.palletUnitsTotal, 0), 0),
      vehiclePalletSlots: 8,
      occupancyPct: 0,
      palletUnitsPerSlot: 40,
      estimatedPhysicalSlots: Math.ceil(orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.palletUnitsTotal, 0), 0) / 40),
    },
  };
}

export async function optimizeRealHandler(body: unknown): Promise<HandlerResult> {
  const b = (body && typeof body === "object" ? body : {}) as any;
  const transportId = Number(b.transportId);

  if (!transportId || isNaN(transportId)) {
    return { status: 400, body: { error: "transportId requerido" } };
  }

  try {
    const [routes, materials] = await Promise.all([loadRoutes(), loadMaterials()]);
    const transport = routes.find((r: any) => r.transportId === transportId);
    if (!transport) return { status: 404, body: { error: `Transporte ${transportId} no encontrado` } };

    const inputPayload = await transportToInputPayload(transport, materials);

    if (inputPayload.stops.length === 0) {
      return { status: 422, body: { error: "Este transporte no tiene paradas geocodificadas. Ejecuta el geocodificador primero.", transportId, totalStops: transport.stops.length } };
    }

    const t0 = Date.now();
    const routePlan = optimizeRoute(inputPayload);

    // Convertir routePlan a formato InputData de optimizer-load
    const inputDataForLoad = {
      depot: inputPayload.depot,
      vehicle: { id: inputPayload.vehicle.id, type: "8_pallet_truck" as const, palletSlots: 8, access: inputPayload.vehicle.access },
      driver: inputPayload.driver,
      stops: inputPayload.stops.map(s => ({
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
      orders: inputPayload.orders.map(o => ({
        id: o.id,
        stopId: o.stopId,
        paymentType: inputPayload.stops.find(s => s.id === o.stopId)?.paymentType ?? "CREDITO",
        items: o.items.map(i => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit as any,
          volume: i.volume_L,
          weight: i.weight_kg,
          returnable: i.returnable,
          warehouseLocation: i.warehouseLocation,
          handlingType: i.handlingType === "barrel" ? "keg" as const : i.handlingType === "crate" ? "crate" as const : "box" as const,
        })),
      })),
    };

    // Convertir RoutePlan de optimizer-route a formato de optimizer-load
    const routePlanForLoad = {
      id: `route-${transportId}`,
      totalStops: routePlan.stops.length,
      estimatedKm: routePlan.kpis?.totalDistanceKm ?? 0,
      estimatedMinutes: routePlan.kpis?.totalDriveMinutes ?? 0,
      stops: routePlan.stops.map(s => ({
        sequence: s.sequence,
        stopId: s.stopId,
        clientName: s.clientName,
        clusterId: s.clusterId ?? "cluster-default",
        arrivalEta: s.eta?.estimated ?? "09:00",
        serviceMinutes: s.serviceMinutes ?? 10,
        reasoning: (s.reasoning ?? []).map((r: any) => (typeof r === "string" ? r : r.text ?? "")),
      })),
    };

    const loadPlan = optimizeLoad(inputDataForLoad as any, routePlanForLoad as any, { blockSize: 4 });

    return {
      status: 200,
      body: {
        transportId,
        date: transport.date,
        route: transport.route,
        driverName: transport.driverName,
        inputPayload,
        routePlan,
        loadPlan,
        summary: {
          totalStops: inputPayload.stops.length,
          stopsSkippedNoCoords: transport.stops.length - inputPayload.stops.length,
          totalPalletSlots: loadPlan.palletSlots.length,
          warnings: loadPlan.warnings.length,
          elapsedMs: Date.now() - t0,
        },
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: 500, body: { error: message } };
  }
}
