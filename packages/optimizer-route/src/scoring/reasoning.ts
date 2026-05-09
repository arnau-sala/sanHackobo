import { ScoreBreakdown, EnrichedStop } from "../types/internal.types";
import { ReasonLine } from "../types/output.types";
import { minToTime } from "../geo/haversine";

export function generateReasoning(
  candidate: EnrichedStop,
  breakdown: ScoreBreakdown,
  isFirstInCluster: boolean,
  projectedArrivalMin: number,
  waitMinutes: number
): ReasonLine[] {
  const reasons: ReasonLine[] = [];
  const tw = candidate.stop.timeWindow;

  if (breakdown.urgency > 0.7) {
    reasons.push({ text: `Ventana horaria a punto de cerrar — cierra a las ${tw.to}`, type: "warning" });
  } else if (breakdown.urgency >= 0.3) {
    reasons.push({ text: `Dentro de ventana horaria activa (${tw.from}–${tw.to})`, type: "positive" });
  }

  if (waitMinutes > 0) {
    reasons.push({ text: `Llegada anticipada — espera ${waitMinutes} min hasta apertura (${tw.from})`, type: "info" });
  }

  if (breakdown.confidence > 0.85) {
    reasons.push({ text: `Alta fiabilidad histórica del cliente (${Math.round(breakdown.confidence * 100)}%)`, type: "positive" });
  } else if (breakdown.confidence < 0.70) {
    reasons.push({ text: `Cliente con baja confianza (${Math.round(breakdown.confidence * 100)}%) — servicio preferente para fidelizar`, type: "info" });
  }

  if (breakdown.cohesion > 0.5 && !isFirstInCluster) {
    reasons.push({ text: "Mismo punto de aparcamiento que parada anterior — sin reposicionamiento", type: "positive" });
  }

  if (breakdown.proximity > 0.75) {
    reasons.push({ text: "Parada más cercana disponible", type: "positive" });
  }

  if (breakdown.paymentPriority > 0.8 && candidate.collectionAmount > 0) {
    reasons.push({ text: `Cobro CONTADO pendiente (${candidate.collectionAmount.toFixed(2)} €) — prioritario`, type: "warning" });
  }

  if (candidate.barrelCount > 0) {
    reasons.push({ text: `${candidate.barrelCount} barril(es) — requiere transpaleta`, type: "info" });
  }

  if (candidate.stop.paymentType === "CREDITO") {
    reasons.push({ text: "Pago CRÉDITO — no requiere cobro en parada", type: "info" });
  }

  if (reasons.length === 0) {
    reasons.push({ text: "Selección por equilibrio óptimo de los 6 criterios de scoring", type: "info" });
  }

  return reasons;
}
