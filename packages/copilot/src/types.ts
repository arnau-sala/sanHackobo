export type LatLng = {
  lat: number;
  lng: number;
};

export type TimeWindow = {
  from: string;
  to: string;
};

export type Depot = {
  id: string;
  name: string;
} & LatLng;

export type Vehicle = {
  id: string;
  type: string;
  palletSlots: number;
  access: string[];
};

export type Driver = {
  id: string;
  name: string;
};

export type Stop = {
  id: string;
  clientId: string;
  clientName: string;
  address: string;
  zone: string;
  route: string;
  timeWindow?: TimeWindow;
  historicalConfidence?: number;
  orders: string[];
} & LatLng;

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  volume?: number;
  weight?: number;
  returnable?: boolean;
  warehouseLocation?: string;
  handlingType?: string;
};

export type Order = {
  id: string;
  stopId: string;
  paymentType?: string;
  items: OrderItem[];
};

export type InputData = {
  depot: Depot;
  vehicle: Vehicle;
  driver: Driver;
  stops: Stop[];
  orders: Order[];
};

export type RoutePlanStop = {
  sequence: number;
  stopId: string;
  clusterId?: string;
  clientName?: string;
  arrivalEta?: string;
  serviceMinutes?: number;
  reasoning?: string[];
};

export type RoutePlan = {
  id?: string;
  totalStops?: number;
  estimatedKm?: number;
  estimatedMinutes?: number;
  confidenceScore?: number;
  zoneDeviationScore?: number;
  stops: RoutePlanStop[];
};

export type LoadItem = {
  stopId: string;
  clientName: string;
  productId: string;
  quantity: number;
  unit: string;
  layer?: string;
  returnable?: boolean;
};

export type PalletSlot = {
  slotId: string;
  side: string;
  accessPriority?: string;
  routeBlock?: string;
  reservedFor?: string;
  items?: LoadItem[];
};

export type LoadWarning = {
  type: string;
  message: string;
};

export type LoadPlan = {
  vehicleId: string;
  strategy?: string;
  palletSlots: PalletSlot[];
  warnings?: LoadWarning[];
  estimatedPickingComplexity?: number;
  estimatedUnloadingComplexity?: number;
};

export type CopilotQuestionInput = {
  currentStopId: string;
  question: string;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  inputData: InputData;
};

export type CopilotAction =
  | {
      type: "highlight_truck_slot";
      slotId: string;
    }
  | {
      type: "highlight_stop";
      stopId: string;
    }
  | {
      type: "show_reasoning";
      stopId: string;
    };

export type CopilotResponse = {
  answer: string;
  actions: CopilotAction[];
  context?: {
    currentStopName?: string;
    sequence?: number;
  };
};
