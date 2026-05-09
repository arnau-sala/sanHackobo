import { haversineDistance, timeToMin } from "./geo";

export interface ScoringWeights {
  proximity: number;
  urgency: number;
  confidence: number;
  cohesion: number;
  priority: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  proximity: 0.40,
  urgency: 0.30,
  confidence: 0.10,
  cohesion: 0.15,
  priority: 0.05,
};

export interface ScoringContext {
  currentLat: number;
  currentLng: number;
  currentTimeMinutes: number;
  currentClusterId: string | null;
  stopToCluster: Map<string, string>;
  maxDistance: number;
}

export interface ScoreBreakdown {
  proximity: number;
  urgency: number;
  confidence: number;
  cohesion: number;
  priority: number;
}

export function scoreStop(
  candidate: any,
  ctx: ScoringContext,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): { totalScore: number; breakdown: ScoreBreakdown } {
  const distance = haversineDistance(ctx.currentLat, ctx.currentLng, candidate.lat, candidate.lng);
  const proximity = 1 - Math.min(distance / ctx.maxDistance, 1);

  const windowEnd = timeToMin(candidate.timeWindow.to);
  const windowStart = timeToMin(candidate.timeWindow.from);
  const minsUntilClose = windowEnd - ctx.currentTimeMinutes;
  let urgency = 0.3;
  if (minsUntilClose <= 0) {
    urgency = 0; // ventana cerrada
  } else if (ctx.currentTimeMinutes < windowStart) {
    urgency = 0.1; // aún no abre, baja urgencia
  } else if (minsUntilClose < 60) {
    urgency = 1 - minsUntilClose / 60; // se acaba el tiempo
  }

  const confidence = candidate.historicalConfidence ?? 0.5;

  const candidateCluster = ctx.stopToCluster.get(candidate.id);
  const cohesion = ctx.currentClusterId === candidateCluster ? 1 : 0;

  const priority = (candidate.priority ?? 5) / 10;

  const breakdown: ScoreBreakdown = { proximity, urgency, confidence, cohesion, priority };

  const totalScore =
    weights.proximity * proximity +
    weights.urgency * urgency +
    weights.confidence * confidence +
    weights.cohesion * cohesion +
    weights.priority * priority;

  return { totalScore, breakdown };
}

export function generateReasoning(
  candidate: any,
  breakdown: ScoreBreakdown,
  isFirstInCluster: boolean,
  routeRef: string
): string[] {
  const reasons: string[] = [];

  if (breakdown.urgency > 0.7) {
    reasons.push(`Ventana horaria a punto de cerrar (cierra ${candidate.timeWindow.to})`);
  } else if (breakdown.urgency >= 0.3) {
    reasons.push(`Dentro de ventana horaria activa (${candidate.timeWindow.from}–${candidate.timeWindow.to})`);
  }

  if (breakdown.confidence > 0.85) {
    reasons.push(`Alta confianza histórica (${Math.round(breakdown.confidence * 100)}%)`);
  } else if (breakdown.confidence < 0.65) {
    reasons.push(`Cliente nuevo o baja confianza — servicio preferente para consolidar relación`);
  }

  if (breakdown.cohesion > 0.5 && !isFirstInCluster) {
    reasons.push("Mismo cluster que parada anterior — sin reposicionamiento del vehículo");
  }

  if (breakdown.proximity > 0.7) {
    reasons.push("Parada cercana a la posición actual — minimiza desplazamiento");
  }

  if (candidate.route === routeRef) {
    reasons.push(`Dentro de la ruta de referencia ${routeRef} — baja desviación de zona`);
  }

  if (candidate.priority >= 9) {
    reasons.push(`Prioridad máxima (${candidate.priority}/10) — cliente clave`);
  }

  if (reasons.length === 0) {
    reasons.push("Selección por equilibrio óptimo de los 5 criterios de scoring");
  }

  return reasons;
}
