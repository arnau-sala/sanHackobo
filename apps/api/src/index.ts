import http from "http";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { copilotRoute } from "./routes/copilot";
import { demoScenarioRoute } from "./routes/demo-scenario";
import { handsfreeDemoRoute } from "./routes/handsfree-demo";
import { optimizeLoadHandler } from "./routes/optimize-load";
import { optimizeRouteHandler } from "./routes/optimize-route";
import { pipelineHandler } from "./routes/pipeline";
import { voiceHandsfreeRoute } from "./routes/voice-handsfree";
import { voiceQueryRoute } from "./routes/voice-query";

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

  if (method === "POST" && pathname === "/api/pipeline") {
    try {
      const body = await readJsonBody(req);
      const result = await pipelineHandler(body);
      sendJson(res, result.status, result.body);
      return;
    } catch {
      sendJson(res, 400, { error: "JSON invalido en el body" });
      return;
    }
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

  sendJson(res, 404, {
    error: "Ruta no encontrada",
    available: [
      "GET /health",
      "GET /api/demo-scenario",
      "GET /handsfree",
      "POST /api/copilot",
      "POST /api/optimize-route",
      "POST /api/optimize-load",
      "POST /api/pipeline",
      "POST /api/voice/query",
      "POST /api/voice/handsfree",
    ],
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${PORT}`);
});
