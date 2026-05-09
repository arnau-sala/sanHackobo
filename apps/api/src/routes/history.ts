/**
 * GET /api/history              — resumen: drivers, dateRange, totalRoutes
 * GET /api/history/drivers      — lista de repartidores únicos
 * GET /api/history/routes       — transportes filtrados (?driverId=&date=&route=)
 * GET /api/history/route/:id    — transporte específico por transportId
 */
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { HandlerResult } from "./optimize-load.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/api/src/routes → ../../../../data/processed
const PROCESSED = resolve(__dirname, "../../../../data/processed");

let _routesCache: any[] | null = null;
let _driversCache: any[] | null = null;

async function loadRoutes(): Promise<any[]> {
  if (_routesCache) return _routesCache;
  try {
    const txt = await readFile(`${PROCESSED}/routes-history.json`, "utf8");
    _routesCache = JSON.parse(txt);
    return _routesCache!;
  } catch {
    return [];
  }
}

async function loadDrivers(): Promise<any[]> {
  if (_driversCache) return _driversCache;
  try {
    const txt = await readFile(`${PROCESSED}/drivers.json`, "utf8");
    _driversCache = JSON.parse(txt);
    return _driversCache!;
  } catch {
    return [];
  }
}

function normalizeDate(d: string): string {
  if (!d) return "";
  // DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [day, mo, yr] = d.split("/");
    return `${yr}-${mo}-${day}`;
  }
  return d;
}

export async function historyHandler(
  method: string,
  path: string,
  query: Record<string, string>,
  pathParam?: string,
): Promise<HandlerResult> {
  // GET /api/history/drivers
  if (path === "/api/history/drivers") {
    const drivers = await loadDrivers();
    return { status: 200, body: drivers };
  }

  // GET /api/history/route/:id
  if (path.startsWith("/api/history/route/")) {
    const id = Number(pathParam ?? path.replace("/api/history/route/", ""));
    const routes = await loadRoutes();
    const found = routes.find((r: any) => r.transportId === id);
    if (!found) return { status: 404, body: { error: "Transport not found" } };
    return { status: 200, body: found };
  }

  // GET /api/history/routes (con filtros opcionales)
  if (path === "/api/history/routes") {
    const routes = await loadRoutes();
    let result = routes;

    if (query.driverId) {
      const did = Number(query.driverId);
      result = result.filter((r: any) => r.driverId === did);
    }
    if (query.date) {
      const d = normalizeDate(query.date);
      result = result.filter((r: any) => r.date === d);
    }
    if (query.route) {
      result = result.filter((r: any) => r.route === query.route.toUpperCase());
    }

    return { status: 200, body: { total: result.length, routes: result } };
  }

  // GET /api/history — resumen
  const routes = await loadRoutes();
  const drivers = await loadDrivers();

  const dates = [...new Set(routes.map((r: any) => r.date))].sort();
  const dateRange = dates.length
    ? { from: dates[0], to: dates[dates.length - 1] }
    : { from: null, to: null };

  return {
    status: 200,
    body: {
      drivers: drivers.length,
      totalRoutes: routes.length,
      dateRange,
      availableDates: dates.slice(-30), // últimas 30 fechas
      routeCodes: [...new Set(routes.map((r: any) => r.route))].sort(),
    },
  };
}
