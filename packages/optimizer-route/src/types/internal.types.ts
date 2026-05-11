import { Stop, Order } from "./input.types";

// Parada enriquecida con datos pre-calculados de sus orders
export interface EnrichedStop {
  stop: Stop;
  orders: Order[];
  totalPalletUnits: number;
  totalWeightKg: number;
  totalVolumeL: number;
  returnablesCount: number;    // items con returnable=true (estimación a recoger)
  barrelCount: number;
  crateCount: number;
  collectionAmount: number;
  warehouseLocations: string[];
}

export interface VehicleState {
  usedPalletUnits: number;
  maxPalletUnits: number;
  returnablesOnBoard: number;
  currentLat: number;
  currentLng: number;
  loadedStopIds: string[];     // en orden de carga (LIFO: último = primero en entregar)
}

export interface DriverState {
  continuousDriveMin: number;
  totalDriveMin: number;
  totalWorkMin: number;
  lastBreakAtMin: number;
}

export interface ScoringWeights {
  proximity: number;
  urgency: number;
  confidence: number;
  cohesion: number;
  paymentPriority: number;     // CONTADO > CREDITO cuando hay cobro pendiente
  capacityImpact: number;      // penaliza paradas que ocupan mucho si el camión está casi lleno
}

export interface ScoringContext {
  currentLat: number;
  currentLng: number;
  currentTimeMinutes: number;
  currentClusterId: string | null;
  stopToCluster: Map<string, string>;
  maxDistance: number;
  vehicleState: VehicleState;
  driverState: DriverState;
}

export interface ScoreBreakdown {
  proximity: number;
  urgency: number;
  confidence: number;
  cohesion: number;
  paymentPriority: number;
  capacityImpact: number;
}

export interface CandidateScore {
  enrichedStop: EnrichedStop;
  totalScore: number;
  breakdown: ScoreBreakdown;
  feasible: boolean;
  infeasibilityReason?: string;
  projectedArrivalMin: number;
  projectedDriveMin: number;
  projectedDistM: number;
}
