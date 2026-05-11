// Contrato con Persona 5 (mapa) y consumidores de la API

import { TimeWindow } from "./input.types";

export type ReasonType = "positive" | "warning" | "info";

export interface ReasonLine {
  text: string;
  type: ReasonType;
}

export interface ETAInterval {
  estimated: string;    // "HH:MM"
  earliest: string;
  latest: string;
  confidencePct: number;
}

export interface ParkingPoint {
  name: string;
  lat: number;
  lng: number;
  walkingMeters: number;
}

export interface PlannedStopOrder {
  orderId: string;
  documentId: string;
  items: Array<{ productId: string; name: string; quantity: number; unit: string; palletUnitsTotal: number }>;
  collectionAmount: number;
  totalAmount: number;
}

export interface VehicleStateAfter {
  usedPalletUnits: number;
  totalPalletUnits: number;           // capacidad total del camión
  occupancyPct: number;
  returnablesOnBoard: number;         // barriles/cajas vacías recogidas hasta aquí
}

export interface PlannedStop {
  sequence: number;
  stopId: string;
  clusterId: string;
  clientId: string;
  clientName: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  timeWindow: TimeWindow;
  paymentType: "CONTADO" | "CREDITO";
  eta: ETAInterval;
  waitMinutes: number;
  serviceMinutes: number;
  driveDistanceM: number;
  driveMinutes: number;
  parkingPoint: ParkingPoint;
  orders: PlannedStopOrder[];
  collectionAmountTotal: number;      // suma cobrable en esta parada
  palletUnitsDelivered: number;
  returnablesToPickup: number;        // barriles/cajas vacías estimados a recoger
  vehicleStateAfter: VehicleStateAfter;
  reasoning: ReasonLine[];
  scoreDebug?: Record<string, number>;
}

export interface DriverBreak {
  afterSequence: number;             // insertar pausa después de esta parada
  durationMin: number;
  regulationRef: string;             // "EU_REG_561_2006_4H30"
  location?: { lat: number; lng: number; description: string };
}

export interface LoadingInstruction {
  loadingPosition: number;           // 1 = primero en subir = último en entregar
  stopId: string;
  clientName: string;
  palletUnits: number;
  barrels: number;
  crates: number;
  warehouseLocations: string[];      // de dónde coger en almacén
  note: string;
}

export interface ClusterOutput {
  id: string;
  parkingPointName: string;   // nombre de la calle/zona donde para el camión
  centroidLat: number;        // coords del centro geométrico del cluster
  centroidLng: number;
  stopIds: string[];
  walkingMeters: number;      // distancia máxima a pie desde parking hasta un cliente
  reason: string;
}

export interface KpiBlock {
  totalDistanceKm: number;
  totalDriveMinutes: number;
  totalServiceMinutes: number;
  totalWaitMinutes: number;
  totalCollectionEur: number;        // suma de todos los collectionAmount
  palletOccupancyPct: number;
  returnablesTotalPickup: number;
  skippedStops: Array<{ stopId: string; clientName: string; reason: string }>;
  routeAdherencePct: number;         // % paradas dentro de su ventana horaria
}

export interface ComparisonBlock {
  baseline: { km: number; minutes: number; description: string };
  optimized: { km: number; minutes: number; description: string };
  savings: { km: number; minutes: number; percentage: number };
}

export interface RoutePlan {
  id: string;
  loadId: string;
  generatedAt: string;
  deliveryDate: string;
  algorithm: string;
  depot: { id: string; name: string; lat: number; lng: number };
  driver: { id: string; name: string };
  vehicle: { id: string; plate: string; palletSlots: number; totalPalletUnits: number };
  stops: PlannedStop[];
  driverBreaks: DriverBreak[];
  loadingOrder: LoadingInstruction[];
  clusters: ClusterOutput[];
  kpis: KpiBlock;
  comparison: ComparisonBlock;
  returnToDepotEta: ETAInterval;
  meta: {
    solveMs: number;
    stopsRequested: number;
    stopsPlanned: number;
    stopsSkipped: number;
    ordersTotal: number;
  };
}
