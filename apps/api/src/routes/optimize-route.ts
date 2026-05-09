import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InputPayload, ScoringWeights } from "@damm/optimizer-route";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const optimizerDist = path.join(repoRoot, "packages/optimizer-route/dist/index.js");

const {
  optimizeRoute,
  DEFAULT_WEIGHTS,
} = require(optimizerDist) as {
  optimizeRoute: (input: InputPayload, weights?: ScoringWeights) => unknown;
  DEFAULT_WEIGHTS: ScoringWeights;
};

export type HandlerResult = {
  status: number;
  body: unknown;
};

export async function optimizeRouteHandler(body: unknown): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: { error: "Invalid JSON body" },
    };
  }

  const payload = body as Record<string, unknown>;
  const depot = payload.depot;
  const stops = payload.stops;

  if (!depot || typeof depot !== "object" || !Array.isArray(stops) || stops.length === 0) {
    return {
      status: 400,
      body: { error: "Body must include depot and non-empty stops array" },
    };
  }

  try {
    const t0 = Date.now();
    const weights = (payload.weights as ScoringWeights | undefined) ?? DEFAULT_WEIGHTS;
    const routePlan = optimizeRoute(body as InputPayload, weights);

    return {
      status: 200,
      body: {
        routePlan,
        meta: {
          elapsedMs: Date.now() - t0,
          algorithm: "greedy_multi_objective_v1",
          stopsCount: stops.length,
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
