/**
 * Pipeline central del demo:
 *
 *   InputData (mock)  ──►  RoutePlan (mock)  ──►  optimizeLoad  ──►  LoadPlan
 *
 * El UI solo importa de aqui para garantizar que todos los paneles ven la
 * misma instancia de plan (un unico "estado de mundo"). El backend usa los
 * mismos modulos en sus endpoints, asi que cualquier panel puede hablar con
 * la API real sin cambios en la estructura de datos.
 */
import {
  mockInputData,
  mockRoutePlan,
  optimizeLoad,
  type InputData,
  type LoadPlan,
  type RoutePlan,
} from "@damm/optimizer-load";

export type Pipeline = {
  inputData: InputData;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
};

const HYBRID_OPTS = { blockSize: 4 } as const;
const TRADITIONAL_OPTS = { blockSize: 999 } as const;

export function buildPipeline(opts: { blockSize?: number } = {}): Pipeline {
  const loadPlan = optimizeLoad(mockInputData, mockRoutePlan, {
    blockSize: opts.blockSize ?? HYBRID_OPTS.blockSize,
  });
  return {
    inputData: mockInputData,
    routePlan: mockRoutePlan,
    loadPlan,
  };
}

/** Estrategia "antes": un solo bloque, tipico de carga por almacen. */
export function buildTraditional(): Pipeline {
  return buildPipeline({ blockSize: TRADITIONAL_OPTS.blockSize });
}

/** Estrategia "despues": hibrido por bloques de ruta. */
export function buildHybrid(): Pipeline {
  return buildPipeline({ blockSize: HYBRID_OPTS.blockSize });
}
