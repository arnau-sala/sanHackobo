/**
 * POST /api/optimize-load
 *
 *   body: { inputData: InputData, routePlan: RoutePlan, options?: { blockSize? } }
 *   response: { loadPlan: LoadPlan, meta: { elapsedMs, strategy } }
 *
 * Si el body llega vacio o sin `inputData`, se usan los mocks reusables
 * para que la API responda algo coherente sin parser de Excel/PDF.
 */
import {
  mockInputData,
  mockRoutePlan,
  optimizeLoad,
  type InputData,
  type RoutePlan,
} from "@damm/optimizer-load";

export type HandlerResult = {
  status: number;
  body: unknown;
};

type OptimizeLoadBody = Partial<{
  inputData: InputData;
  routePlan: RoutePlan;
  options: { blockSize?: number };
}>;

export async function optimizeLoadHandler(
  body: unknown,
): Promise<HandlerResult> {
  const payload = (body && typeof body === "object" ? body : {}) as OptimizeLoadBody;
  const inputData = payload.inputData ?? mockInputData;
  const routePlan = payload.routePlan ?? mockRoutePlan;

  try {
    const t0 = Date.now();
    const loadPlan = optimizeLoad(inputData, routePlan, payload.options ?? {});
    return {
      status: 200,
      body: {
        loadPlan,
        meta: {
          elapsedMs: Date.now() - t0,
          strategy: loadPlan.strategy,
          slotsCount: loadPlan.palletSlots.length,
          warningsCount: loadPlan.warnings.length,
          usedMocks: !payload.inputData || !payload.routePlan,
        },
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: 500,
      body: { error: message },
    };
  }
}

/**
 * GET /api/pipeline/run
 *
 * Hace el flujo completo end-to-end con los mocks:
 *   InputData -> optimizeRoute (omitido aqui, se usa mockRoutePlan)
 *               -> optimizeLoad -> LoadPlan
 *
 * Util para que el frontend hidrate todo el demo en una sola llamada y
 * para tests manuales con curl.
 */
export async function pipelineRunHandler(): Promise<HandlerResult> {
  try {
    const t0 = Date.now();
    const loadPlan = optimizeLoad(mockInputData, mockRoutePlan, { blockSize: 4 });
    return {
      status: 200,
      body: {
        inputData: mockInputData,
        routePlan: mockRoutePlan,
        loadPlan,
        meta: {
          elapsedMs: Date.now() - t0,
          strategy: loadPlan.strategy,
        },
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: 500,
      body: { error: message },
    };
  }
}
