import type { InputData, OptimizeLoadOptions, RoutePlan as LoadRoutePlan } from "@damm/optimizer-load";
import { optimizeLoad } from "@damm/optimizer-load";

export type HandlerResult = {
  status: number;
  body: unknown;
};

export async function optimizeLoadHandler(body: unknown): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: { error: "Body JSON invalido" },
    };
  }

  const payload = body as Record<string, unknown>;
  const inputData = payload.inputData as InputData | undefined;
  const routePlan = payload.routePlan as LoadRoutePlan | undefined;
  const options = (payload.options as OptimizeLoadOptions | undefined) ?? {};

  if (!inputData?.depot || !inputData.vehicle || !Array.isArray(inputData.stops) || !inputData.orders) {
    return {
      status: 400,
      body: { error: "Falta inputData valido (depot, vehicle, stops, orders)" },
    };
  }

  if (!routePlan?.stops || routePlan.stops.length === 0) {
    return {
      status: 400,
      body: { error: "Falta routePlan con stops no vacio" },
    };
  }

  try {
    const t0 = Date.now();
    const loadPlan = optimizeLoad(inputData, routePlan, options);
    return {
      status: 200,
      body: {
        loadPlan,
        meta: { elapsedMs: Date.now() - t0 },
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
