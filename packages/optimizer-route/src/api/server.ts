import express from "express";
import optimizeRouter from "./routes/optimize.router";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Tamaño máximo del payload: 1 MB (un input Damm real son ~50 KB)
app.use(express.json({ limit: "1mb" }));

// CORS: en producción restringir al origen de Persona 5
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173").split(",");
app.use((_req, res, next) => {
  const origin = _req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api/v1", optimizeRouter);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", uptime: process.uptime() });
});

const server = app.listen(PORT, () => {
  console.log(`🚚 Optimizer API corriendo en http://localhost:${PORT}`);
  console.log(`   POST /api/v1/optimize       → ruta completa`);
  console.log(`   GET  /api/v1/optimize/maps  → waypoints Google Maps`);
  console.log(`   GET  /api/v1/health         → estado`);
});

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} recibido — cerrando servidor...`);
  server.close(() => {
    console.log("Servidor cerrado.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

export default app;
