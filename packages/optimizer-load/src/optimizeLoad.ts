import type {
  BuildTruckLayoutOptions,
  InputData,
  LoadPlan,
  RoutePlan,
} from "./types.js";
import { buildTruckLayout } from "./helpers/buildTruckLayout.js";
import { buildRouteBlocks } from "./helpers/buildRouteBlocks.js";
import { assignItemsToSlots } from "./helpers/assignItemsToSlots.js";
import { computeLoadKpis } from "./helpers/computeLoadKpis.js";
import { generateLoadWarnings } from "./helpers/generateLoadWarnings.js";
import { generateLoadExplanation } from "./helpers/generateLoadExplanation.js";

export interface OptimizeLoadOptions extends BuildTruckLayoutOptions {
  /** Tamaño de bloque de ruta (default 4 paradas). */
  blockSize?: number;
}

/**
 * Función principal del motor de carga.
 *
 *   Inputs:
 *     - inputData: pedidos, productos, vehículo, almacén normalizados.
 *     - routePlan: orden de paradas recomendado por el optimizador de ruta.
 *
 *   Output:
 *     - LoadPlan con slots, route blocks, retornables, warnings y KPIs.
 */
export function optimizeLoad(
  inputData: InputData,
  routePlan: RoutePlan,
  options: OptimizeLoadOptions = {},
): LoadPlan {
  const slots = buildTruckLayout(inputData.vehicle, options);
  const blocks = buildRouteBlocks(routePlan, slots, options.blockSize ?? 4);
  const assign = assignItemsToSlots(inputData, routePlan, blocks, slots);

  const partial: LoadPlan = {
    vehicleId: inputData.vehicle.id,
    strategy: "hybrid_by_route_blocks",
    palletSlots: slots,
    routeBlocks: blocks,
    returnablesPlan: assign.returnablesPlan,
    warnings: [], // se rellenan abajo
    kpis: {
      estimatedPickingComplexity: 0,
      estimatedUnloadingComplexity: 0,
      truckFillRatio: 0,
      routeAlignmentScore: 0,
      returnablesReadinessScore: 0,
      heavyItemsBottomRatio: 0,
      stopsWithDirectAccessRatio: 0,
    },
    explanation: [],
  };

  partial.kpis = computeLoadKpis(partial);
  partial.warnings = generateLoadWarnings(partial, inputData, assign);
  partial.explanation = generateLoadExplanation(partial);

  return partial;
}
