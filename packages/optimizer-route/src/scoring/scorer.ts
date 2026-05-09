import { timeToMin } from "../geo/haversine";
import { ScoringContext, ScoringWeights, ScoreBreakdown, EnrichedStop } from "../types/internal.types";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  proximity:       0.35,
  urgency:         0.30,
  confidence:      0.10,
  cohesion:        0.15,
  paymentPriority: 0.05,
  capacityImpact:  0.05,
};

export function scoreStop(
  candidate: EnrichedStop,
  ctx: ScoringContext,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): { totalScore: number; breakdown: ScoreBreakdown; projectedArrivalMin: number; projectedDistM: number; projectedDriveMin: number } {
  const { haversineDistance } = require("../geo/haversine");
  const { estimateTravelMinutes } = require("../geo/travelTime");

  const distM: number = haversineDistance(ctx.currentLat, ctx.currentLng, candidate.stop.lat, candidate.stop.lng);
  const driveMin: number = estimateTravelMinutes(distM, ctx.currentTimeMinutes, "rural");
  const projectedArrivalMin = ctx.currentTimeMinutes + driveMin;

  // 1. Proximidad
  const proximity = 1 - Math.min(distM / ctx.maxDistance, 1);

  // 2. Urgencia ventana horaria
  const windowClose = timeToMin(candidate.stop.timeWindow.to);
  const windowOpen  = timeToMin(candidate.stop.timeWindow.from);
  const minsUntilClose = windowClose - ctx.currentTimeMinutes;
  const windowDuration = windowClose - windowOpen;
  let urgency = 0.2;
  if (minsUntilClose <= 0) {
    urgency = 0;
  } else if (ctx.currentTimeMinutes < windowOpen) {
    urgency = 0.1; // aún no abre
  } else if (minsUntilClose < 60) {
    urgency = 0.5 + 0.5 * (1 - minsUntilClose / 60);
  } else if (windowDuration < 240) {
    // ventana corta (<4h) = más urgente que una ventana amplia
    urgency = 0.35;
  }

  // 3. Confianza histórica
  const confidence = candidate.stop.historicalConfidence;

  // 4. Cohesión de cluster
  const candidateCluster = ctx.stopToCluster.get(candidate.stop.id);
  const cohesion = ctx.currentClusterId === candidateCluster ? 1 : 0;

  // 5. Prioridad de cobro (CONTADO > CREDITO si hay importe pendiente)
  const paymentPriority = candidate.stop.paymentType === "CONTADO" && candidate.collectionAmount > 0
    ? 1.0
    : 0.3;

  // 6. Impacto capacidad (paradas con muchos barriles penalizan si camión está >80% lleno)
  const occupancyPct = ctx.vehicleState.usedPalletUnits / ctx.vehicleState.maxPalletUnits;
  let capacityImpact = 1.0;
  if (occupancyPct > 0.8 && candidate.barrelCount >= 2) {
    capacityImpact = 0.3;
  }

  const breakdown: ScoreBreakdown = { proximity, urgency, confidence, cohesion, paymentPriority, capacityImpact };

  const totalScore =
    weights.proximity       * proximity +
    weights.urgency         * urgency +
    weights.confidence      * confidence +
    weights.cohesion        * cohesion +
    weights.paymentPriority * paymentPriority +
    weights.capacityImpact  * capacityImpact;

  return { totalScore, breakdown, projectedArrivalMin, projectedDistM: distM, projectedDriveMin: driveMin };
}
