import http from "http";
import { existsSync, readFileSync, statSync, createReadStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { copilotRoute } from "./routes/copilot";
import { demoScenarioRoute } from "./routes/demo-scenario";
import { handsfreeDemoRoute } from "./routes/handsfree-demo";
import { optimizeLoadHandler, pipelineRunHandler } from "./routes/optimize-load";
import { optimizeRouteHandler } from "./routes/optimize-route";
import { voiceHandsfreeRoute } from "./routes/voice-handsfree";
import { voiceQueryRoute } from "./routes/voice-query";
import { historyHandler } from "./routes/history";
import { optimizeRealHandler } from "./routes/optimize-real";

function loadEnvFromRoot(): void {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFromRoot();

const PORT = Number(process.env.PORT ?? 3001);

// Static file serving for production (SPA frontend)
const WEB_DIST = path.resolve(__dirname, "../../web/dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

function tryServeStatic(
  res: http.ServerResponse,
  filePath: string,
): boolean {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME_TYPES[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable");
  res.statusCode = 200;
  createReadStream(filePath).pipe(res);
  return true;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

function sendText(
  res: http.ServerResponse,
  status: number,
  body: string,
  contentType: string,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.end(body);
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requestPathname(url: string): string {
  try {
    return new URL(url, "http://127.0.0.1").pathname;
  } catch {
    return url.split("?")[0] || "/";
  }
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";
  const pathname = requestPathname(url);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "copilot-api" });
    return;
  }

  if (method === "GET" && pathname === "/api/demo-scenario") {
    const result = await demoScenarioRoute();
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === "GET" && pathname === "/handsfree") {
    const result = await handsfreeDemoRoute();
    sendText(res, result.status, result.body, result.contentType);
    return;
  }

  if (method === "POST" && pathname === "/api/copilot") {
    try {
      const body = await readJsonBody(req);
      const result = await copilotRoute(body);
      sendJson(res, result.status, result.body);
      return;
    } catch {
      sendJson(res, 400, { error: "JSON invalido en el body" });
      return;
    }
  }

  if (method === "POST" && pathname === "/api/optimize-route") {
    try {
      const body = await readJsonBody(req);
      const result = await optimizeRouteHandler(body);
      sendJson(res, result.status, result.body);
      return;
    } catch {
      sendJson(res, 400, { error: "JSON invalido en el body" });
      return;
    }
  }

  if (method === "POST" && pathname === "/api/optimize-load") {
    try {
      const body = await readJsonBody(req);
      const result = await optimizeLoadHandler(body);
      sendJson(res, result.status, result.body);
      return;
    } catch {
      sendJson(res, 400, { error: "JSON invalido en el body" });
      return;
    }
  }

  if (method === "GET" && pathname === "/api/pipeline/run") {
    const result = await pipelineRunHandler();
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === "POST" && pathname === "/api/voice/query") {
    try {
      const body = await readJsonBody(req);
      const result = await voiceQueryRoute(body);
      sendJson(res, result.status, result.body);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error: "Fallo interno en /api/voice/query",
        details: String(error),
      });
      return;
    }
  }

  if (method === "POST" && pathname === "/api/voice/handsfree") {
    try {
      const body = await readJsonBody(req);
      const result = await voiceHandsfreeRoute(body);
      sendJson(res, result.status, result.body);
      return;
    } catch {
      sendJson(res, 400, { error: "JSON invalido en el body" });
      return;
    }
  }

  // ── History endpoints ──────────────────────────────────────────────────
  if (method === "GET" && (pathname === "/api/history" || pathname === "/api/history/drivers" || pathname === "/api/history/routes" || pathname.startsWith("/api/history/route/"))) {
    const query: Record<string, string> = {};
    try {
      const u = new URL(url, "http://127.0.0.1");
      u.searchParams.forEach((v, k) => { query[k] = v; });
    } catch { /* ignore */ }
    const pathParam = pathname.startsWith("/api/history/route/") ? pathname.replace("/api/history/route/", "") : undefined;
    const result = await historyHandler(method, pathname, query, pathParam);
    sendJson(res, result.status, result.body);
    return;
  }

  // ── Optimize real ──────────────────────────────────────────────────────
  if (method === "POST" && pathname === "/api/optimize/real") {
    try {
      const body = await readJsonBody(req);
      const result = await optimizeRealHandler(body);
      sendJson(res, result.status, result.body);
      return;
    } catch {
      sendJson(res, 400, { error: "JSON invalido en el body" });
      return;
    }
  }

  // Static file serving — only for GET requests outside /api /handsfree /health
  if (method === "GET" && existsSync(WEB_DIST)) {
    // Try exact path match
    const candidate = path.join(WEB_DIST, pathname);
    if (tryServeStatic(res, candidate)) return;

    // SPA fallback — all unmatched GETs get index.html
    const indexHtml = path.join(WEB_DIST, "index.html");
    if (tryServeStatic(res, indexHtml)) return;
  }

  sendJson(res, 404, {
    error: "Ruta no encontrada",
    available: [
      "GET /health",
      "GET /api/demo-scenario",
      "GET /handsfree",
      "POST /api/copilot",
      "POST /api/optimize-route",
      "POST /api/optimize-load",
      "GET /api/pipeline/run",
      "POST /api/voice/query",
      "POST /api/voice/handsfree",
      "GET /api/history",
      "GET /api/history/drivers",
      "GET /api/history/routes?driverId=&date=&route=",
      "GET /api/history/route/:transportId",
      "POST /api/optimize/real",
    ],
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${PORT}`);
});
