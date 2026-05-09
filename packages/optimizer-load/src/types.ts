/**
 * Damm Smart Truck Copilot - Load optimizer types.
 * These types are the public contract of the @damm/optimizer-load package
 * and are designed to be shared with the data pipeline (Persona 1),
 * the route optimizer (Persona 2) and the frontend (Personas 4 & 5).
 */

// ---------- Shared primitives ----------

export type Side = "left" | "right" | "rear" | "center";
export type AccessPriority = "high" | "medium" | "low" | "returnables";
export type Layer = "bottom" | "middle" | "top";

export type HandlingType =
  | "crate" // caja retornable de cerveza/refresco/agua
  | "keg" // barril
  | "box" // caja de unidades (alimentación, limpieza, packs grandes)
  | "bottle" // botella suelta (licor, vino)
  | "unit" // unidad suelta (vasos, abridores, productos pequeños)
  | "unknown";

export type Unit =
  | "Caja"
  | "Barril"
  | "Unidad"
  | "Botella"
  | "Pack"
  | "Tubo"
  | (string & {});

// ---------- Input contracts ----------

export interface Depot {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

export interface Vehicle {
  id: string;
  type: "6_pallet_truck" | "8_pallet_truck" | "3_pallet_van";
  palletSlots: number;
  access: Array<"left" | "right" | "rear">;
  maxVolume?: number;
  maxWeight?: number;
}

export interface Driver {
  id: string;
  name: string;
}

export interface TimeWindow {
  from: string;
  to: string;
}

export interface Stop {
  id: string;
  clientId: string;
  clientName: string;
  address?: string;
  zone?: string;
  route?: string;
  lat?: number;
  lng?: number;
  timeWindow?: TimeWindow;
  historicalConfidence?: number;
  orders: string[];
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unit: Unit;
  volume?: number;
  weight?: number;
  returnable?: boolean;
  warehouseLocation?: string;
  handlingType?: HandlingType;
  stackable?: boolean;
}

export interface Order {
  id: string;
  stopId: string;
  paymentType?: string;
  items: OrderItem[];
}

export interface InputData {
  depot: Depot;
  vehicle: Vehicle;
  driver?: Driver;
  stops: Stop[];
  orders: Order[];
}

// ---------- Route plan ----------

export interface RouteStop {
  sequence: number;
  stopId: string;
  clusterId?: string;
  clientName?: string;
  arrivalEta?: string;
  serviceMinutes?: number;
  reasoning?: string[];
}

export interface RouteCluster {
  id: string;
  stopIds: string[];
  parkingPointName?: string;
  walkingMeters?: number;
  reason?: string;
}

export interface RoutePlan {
  id: string;
  totalStops: number;
  estimatedKm?: number;
  estimatedMinutes?: number;
  stops: RouteStop[];
  clusters?: RouteCluster[];
}

// ---------- Output contract: LoadPlan ----------

export interface LoadedItem {
  stopId: string;
  sequence: number;
  clientName: string;
  productId: string;
  name: string;
  quantity: number;
  unit: Unit;
  layer: Layer;
  accessSide: "left" | "right" | "rear";
  handlingType: HandlingType;
  returnable: boolean;
  reason: string;
}

export interface PalletSlot {
  slotId: string;
  side: Side;
  accessPriority: AccessPriority;
  routeBlock?: string;
  sequenceRange?: { from: number; to: number };
  reservedFor?: "delivery" | "returnables" | "mixed";
  usedVolume?: number;
  usedWeight?: number;
  capacityVolume?: number;
  capacityWeight?: number;
  fillRatio?: number;
  items: LoadedItem[];
}

export interface RouteBlock {
  id: string;
  name: string;
  sequenceRange: { from: number; to: number };
  stopIds: string[];
  assignedSlots: string[];
  strategy: string;
}

export interface ReturnablesPlan {
  reservedSlots: string[];
  estimatedReturnableVolume: number;
  estimatedReturnableWeight: number;
  notes: string[];
}

export type WarningType =
  | "capacity"
  | "heavy_item"
  | "access"
  | "missing_data"
  | "returnables"
  | "stacking";

export type Severity = "info" | "warning" | "critical";

export interface LoadWarning {
  type: WarningType;
  severity: Severity;
  message: string;
  relatedSlotId?: string;
  relatedStopId?: string;
  relatedProductId?: string;
}

export interface LoadKpis {
  estimatedPickingComplexity: number;
  estimatedUnloadingComplexity: number;
  truckFillRatio: number;
  routeAlignmentScore: number;
  returnablesReadinessScore: number;
  heavyItemsBottomRatio: number;
  stopsWithDirectAccessRatio: number;
}

export interface LoadPlan {
  vehicleId: string;
  strategy: "hybrid_by_route_blocks";
  palletSlots: PalletSlot[];
  routeBlocks: RouteBlock[];
  returnablesPlan: ReturnablesPlan;
  warnings: LoadWarning[];
  kpis: LoadKpis;
  explanation: string[];
}

// ---------- Internal helpers ----------

/** Item enriquecido con valores estimados/normalizados antes de asignar. */
export interface EnrichedItem extends OrderItem {
  /** Volumen estimado por la cantidad total. */
  totalVolume: number;
  /** Peso estimado por la cantidad total. */
  totalWeight: number;
  /** Tipología de manipulación normalizada. */
  handlingType: HandlingType;
  /** Si el envase vuelve al camión (retornable) tras la entrega. */
  returnable: boolean;
  /** Si se puede apilar otra cosa encima sin riesgo. */
  stackable: boolean;
  /** Si los datos se han estimado por defaults (para warnings). */
  estimated: { volume: boolean; weight: boolean; handlingType: boolean };
}

export interface BuildTruckLayoutOptions {
  /** Capacidad por palet en m³, default 1.6 m³ (palet euro 0.8x1.2x1.6m útil). */
  palletVolume?: number;
  /** Capacidad por palet en kg, default 750 kg. */
  palletWeight?: number;
}
