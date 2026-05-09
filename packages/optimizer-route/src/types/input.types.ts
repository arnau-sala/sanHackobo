// Contrato exacto con Persona 1 — no modificar sin pactar con ellos

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unit: "Caja" | "Barril" | "Unidad" | string;
  volume_L: number;
  weight_kg: number;
  returnable: boolean;
  warehouseLocation: string;
  handlingType: "crate" | "barrel" | "pack" | "unit";
  palletUnitsEach: number;
  palletUnitsTotal: number;
  palletUnits: number;
}

export interface Order {
  id: string;
  stopId: string;
  documentId: string;
  items: OrderItem[];
  totalAmount: number;
  collectionAmount: number;
}

export interface TimeWindow {
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}

export interface Stop {
  id: string;
  clientId: string;
  clientName: string;
  address: string;
  city: string;
  postalCode: string;
  zone: string;
  route: string;
  lat: number;
  lng: number;
  timeWindow: TimeWindow;
  paymentType: "CONTADO" | "CREDITO";
  historicalConfidence: number; // 0.0–1.0
  orderIds: string[];
}

export interface Vehicle {
  id: string;
  plate: string;
  type: string;
  palletSlots: number;            // slots físicos del camión
  access: Array<"left" | "right" | "rear">;
}

export interface Driver {
  id: string;
  name: string;
  continuousDriveAlreadyMin?: number;  // conducción acumulada antes de esta ruta
  totalDriveAlreadyTodayMin?: number;
}

export interface Depot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

export interface InputPayload {
  loadId: string;
  deliveryDate: string;          // "YYYY-MM-DD"
  depot: Depot;
  vehicle: Vehicle;
  driver: Driver;
  stops: Stop[];
  orders: Order[];
  _summary?: {
    totalStops: number;
    totalOrders: number;
    totalPalletUnits: number;
    vehiclePalletSlots: number;
    occupancyPct: number;
    palletUnitsPerSlot: number;
    estimatedPhysicalSlots: number;
  };
}

// Constantes del modelo de pallets de Damm
export const PALLET_UNITS_PER_SLOT = 40;   // cajas equivalentes por slot físico
export const PALLET_UNITS_CRATE   = 1;     // 1 caja = 1 palletUnit
export const PALLET_UNITS_BARREL  = 4;     // 1 barril = 4 palletUnits (ocupa 4 huecos)
export const BARREL_EMPTY_KG      = 14;    // peso aproximado barril vacío (retornable)
