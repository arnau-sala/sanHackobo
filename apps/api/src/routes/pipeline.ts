import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InputPayload, ScoringWeights } from "@damm/optimizer-route";
import { optimizeLoad, type OptimizeLoadOptions } from "@damm/optimizer-load";

import { inputPayloadToLoadInputData, optimizerRoutePlanToLoadRoutePlan } from "../lib/mapRoutePayload";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const optimizerDist = path.join(repoRoot, "packages/optimizer-route/dist/index.js");

const { optimizeRoute, DEFAULT_WEIGHTS } = require(optimizerDist) as {
  optimizeRoute: (input: InputPayload, weights?: ScoringWeights) => import("@damm/optimizer-route").RoutePlan;
  DEFAULT_WEIGHTS: ScoringWeights;
};

export type HandlerResult = {
  status: number;
  body: unknown;
};

const DEMO_INPUT = path.join(repoRoot, "data/input-demo.json");

export type PipelineBody = {
  inputPayload?: InputPayload;
  weights?: ScoringWeights;
  loadOptions?: OptimizeLoadOptions;
};

export async function pipelineHandler(body: unknown): Promise<HandlerResult> {
  let payload: InputPayload;

  const opts = (body && typeof body === "object" ? (body as PipelineBody) : {}) as PipelineBody;

  if (opts.inputPayload) {
    payload = opts.inputPayload;
  } else if (existsSync(DEMO_INPUT)) {
    const raw = readFileSync(DEMO_INPUT, "utf8");
    payload = JSON.parse(raw) as InputPayload;
  } else {
    return {
      status: 400,
      body: {
        error: "Envia inputPayload en el body o coloca data/input-demo.json en el repo",
      },
    };
  }

  try {
    const t0 = Date.now();
    const weights = opts.weights ?? DEFAULT_WEIGHTS;
    const routePlanOut = optimizeRoute(payload, weights);
    const loadInput = inputPayloadToLoadInputData(payload);
    const loadRoutePlan = optimizerRoutePlanToLoadRoutePlan(routePlanOut);
    const loadPlan = optimizeLoad(loadInput, loadRoutePlan, opts.loadOptions ?? {});

    return {
      status: 200,
      body: {
        inputData: loadInput,
        routePlan: routePlanOut,
        routePlanLoad: loadRoutePlan,
        loadPlan,
        meta: {
          elapsedMs: Date.now() - t0,
          source: opts.inputPayload ? "request" : "data/input-demo.json",
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
