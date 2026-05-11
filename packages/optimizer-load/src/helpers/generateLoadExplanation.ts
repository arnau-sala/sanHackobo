import type { LoadPlan } from "../types.js";

/**
 * Construye una explicación textual del LoadPlan, pensada para mostrarse al
 * conductor / al jurado. Convierte los KPIs y la estructura en frases.
 */
export function generateLoadExplanation(loadPlan: LoadPlan): string[] {
  const lines: string[] = [];

  lines.push(
    `Estrategia: carga híbrida por bloques de ruta sobre ${loadPlan.palletSlots.length} palets.`,
  );

  for (const block of loadPlan.routeBlocks) {
    lines.push(
      `${block.name} (paradas ${block.sequenceRange.from}-${block.sequenceRange.to}): asignado a ${block.assignedSlots.join(", ") || "—"}.`,
    );
  }

  const reserved = loadPlan.returnablesPlan.reservedSlots;
  if (reserved.length > 0) {
    lines.push(
      `Retornables: slot(s) ${reserved.join(", ")} reservado(s); volumen estimado de retorno ${loadPlan.returnablesPlan.estimatedReturnableVolume} m³ y peso ${loadPlan.returnablesPlan.estimatedReturnableWeight} kg.`,
    );
  }

  lines.push(
    `Ocupación del camión: ${(loadPlan.kpis.truckFillRatio * 100).toFixed(0)}%.`,
  );
  lines.push(
    `Alineación con la ruta: ${(loadPlan.kpis.routeAlignmentScore * 100).toFixed(0)}% (paradas tempranas en slots accesibles).`,
  );
  lines.push(
    `Pesados abajo: ${(loadPlan.kpis.heavyItemsBottomRatio * 100).toFixed(0)}% de barriles/cajas pesadas en layer bottom.`,
  );
  lines.push(
    `Acceso directo: ${(loadPlan.kpis.stopsWithDirectAccessRatio * 100).toFixed(0)}% de paradas servidas desde slots high/medium.`,
  );

  if (loadPlan.kpis.estimatedPickingComplexity < 0.3)
    lines.push(
      "Picking en almacén relativamente sencillo: pocas referencias dispersas entre palets.",
    );
  else if (loadPlan.kpis.estimatedPickingComplexity > 0.6)
    lines.push(
      "Picking en almacén más exigente: referencias dispersas para favorecer agrupación por cliente.",
    );
  else
    lines.push(
      "Picking en almacén medio: balance entre agrupación por referencia y agrupación por cliente.",
    );

  if (loadPlan.kpis.estimatedUnloadingComplexity < 0.3)
    lines.push(
      "Descarga sencilla en cliente: items del mismo cliente concentrados en pocos slots.",
    );
  else
    lines.push(
      "Descarga aceptable: algunos clientes con productos en más de un slot dentro del mismo bloque.",
    );

  return lines;
}
