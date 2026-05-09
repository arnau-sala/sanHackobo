import express from "express";
import optimizeRouter from "./routes/optimize.router";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

// CORS permisivo para desarrollo (Persona 5 llama desde localhost)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use("/api/v1", optimizeRouter);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`🚚 Optimizer API corriendo en http://localhost:${PORT}`);
  console.log(`   POST /api/v1/optimize       → ruta completa`);
  console.log(`   GET  /api/v1/optimize/maps  → waypoints Google Maps`);
  console.log(`   GET  /api/v1/health         → estado`);
});

export default app;
