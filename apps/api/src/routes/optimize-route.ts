import { Router, Request, Response } from "express";
import { optimizeRoute, DEFAULT_WEIGHTS } from "@workspace/optimizer-route";

const router = Router();

router.post("/optimize-route", (req: Request, res: Response) => {
  try {
    const { depot, stops, weights } = req.body;

    if (!depot || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: "Body must include depot and non-empty stops array" });
    }

    const t0 = Date.now();
    const routePlan = optimizeRoute({ ...req.body }, weights ?? DEFAULT_WEIGHTS);

    return res.json({
      routePlan,
      meta: {
        elapsedMs: Date.now() - t0,
        algorithm: "greedy_multi_objective_v1",
        stopsCount: stops.length,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
