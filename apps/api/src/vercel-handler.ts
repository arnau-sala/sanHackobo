import { copilotRoute } from "./routes/copilot.js";
import { demoScenarioRoute } from "./routes/demo-scenario.js";
import { handsfreeDemoRoute } from "./routes/handsfree-demo.js";
import {
  optimizeLoadHandler,
  pipelineRunHandler,
} from "./routes/optimize-load.js";
import { optimizeRouteHandler } from "./routes/optimize-route.js";
import { voiceHandsfreeRoute } from "./routes/voice-handsfree.js";
import { voiceQueryRoute } from "./routes/voice-query.js";
import { historyHandler } from "./routes/history.js";
import { optimizeRealHandler } from "./routes/optimize-real.js";

function readBody(req: any): Promise<unknown> {
  if (req.body !== undefined) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // req.url contains the original request URL (Vercel passes it through rewrites)
  const urlObj = new URL(req.url ?? "/", "http://localhost");
  const pathname = urlObj.pathname;
  const method = req.method ?? "GET";

  // Strip /api/ prefix to get the slugPath (e.g. "/api/history" → "history")
  const slugPath = pathname.startsWith("/api/")
    ? pathname.slice(5)
    : pathname.slice(1);

  // Query params
  const query: Record<string, string> = {};
  urlObj.searchParams.forEach((v, k) => { query[k] = v; });

  // ── Health ──────────────────────────────────────────────────────────────
  if (method === "GET" && (slugPath === "health" || pathname === "/health")) {
    res.status(200).json({ ok: true, service: "copilot-api" });
    return;
  }

  // ── Demo scenario ────────────────────────────────────────────────────────
  if (method === "GET" && slugPath === "demo-scenario") {
    const result = await demoScenarioRoute();
    res.status(result.status).json(result.body);
    return;
  }

  // ── Handsfree HTML demo ──────────────────────────────────────────────────
  if (method === "GET" && (slugPath === "handsfree" || pathname === "/handsfree")) {
    const result = await handsfreeDemoRoute();
    res.setHeader("Content-Type", result.contentType);
    res.status(result.status).send(result.body);
    return;
  }

  // ── Copilot ──────────────────────────────────────────────────────────────
  if (method === "POST" && slugPath === "copilot") {
    const body = await readBody(req);
    const result = await copilotRoute(body);
    res.status(result.status).json(result.body);
    return;
  }

  // ── Optimize route ───────────────────────────────────────────────────────
  if (method === "POST" && slugPath === "optimize-route") {
    const body = await readBody(req);
    const result = await optimizeRouteHandler(body);
    res.status(result.status).json(result.body);
    return;
  }

  // ── Optimize load ────────────────────────────────────────────────────────
  if (method === "POST" && slugPath === "optimize-load") {
    const body = await readBody(req);
    const result = await optimizeLoadHandler(body);
    res.status(result.status).json(result.body);
    return;
  }

  // ── Pipeline run ─────────────────────────────────────────────────────────
  if (method === "GET" && slugPath === "pipeline/run") {
    const result = await pipelineRunHandler();
    res.status(result.status).json(result.body);
    return;
  }

  // ── Voice query ──────────────────────────────────────────────────────────
  if (method === "POST" && slugPath === "voice/query") {
    const body = await readBody(req);
    const result = await voiceQueryRoute(body);
    res.status(result.status).json(result.body);
    return;
  }

  // ── Voice handsfree ──────────────────────────────────────────────────────
  if (method === "POST" && slugPath === "voice/handsfree") {
    const body = await readBody(req);
    const result = await voiceHandsfreeRoute(body);
    res.status(result.status).json(result.body);
    return;
  }

  // ── History ──────────────────────────────────────────────────────────────
  if (method === "GET" && slugPath.startsWith("history")) {
    const pathParam = slugPath.startsWith("history/route/")
      ? slugPath.replace("history/route/", "")
      : undefined;
    const result = await historyHandler(method, pathname, query, pathParam);
    res.status(result.status).json(result.body);
    return;
  }

  // ── Optimize real ────────────────────────────────────────────────────────
  if (method === "POST" && slugPath === "optimize/real") {
    const body = await readBody(req);
    const result = await optimizeRealHandler(body);
    res.status(result.status).json(result.body);
    return;
  }

  res.status(404).json({ error: "Route not found", path: pathname });
}
