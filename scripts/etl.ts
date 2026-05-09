/**
 * ETL: raw JSON → data/processed/
 *
 * Genera:
 *   drivers.json           — repartidores únicos con resumen
 *   routes-history.json    — transportes agrupados con paradas y líneas
 *   clients-enriched.json  — clientes con dirección + horarios
 *   materials-enriched.json — materiales con dimensiones + clasificación
 *
 * Uso: npx tsx scripts/etl.ts
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW  = resolve(ROOT, "data/raw");
const OUT  = resolve(ROOT, "data/processed");
const CACHE = resolve(ROOT, "data/geocode-cache.json");

async function readJson(path: string) {
  // Los JSON exportados desde pandas contienen NaN (no válido en JSON estándar).
  // Reemplazamos NaN y Infinity por null antes de parsear.
  const txt = await readFile(path, "utf8");
  const fixed = txt
    .replace(/:\s*NaN/g, ": null")
    .replace(/:\s*Infinity/g, ": null")
    .replace(/:\s*-Infinity/g, ": null");
  return JSON.parse(fixed);
}

function parseDateDDMMYYYY(s: string): string {
  // "30/01/2026" → "2026-01-30"
  if (!s) return "";
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return s;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function inferHandlingType(name: string, unit: string): string {
  const n = name.toUpperCase();
  const u = unit.toUpperCase();
  if (n.includes("BARRIL") || n.includes("KEG") || u === "BAR" || u === "BAR.") return "keg";
  if (n.includes("BOTELLA") || n.includes(" BOT ")) return "bottle";
  if (u === "CAJ" || u === "CAJA") return "crate";
  if (u === "UN" || u === "UNI") return "unit";
  return "box";
}

function inferReturnable(name: string): boolean {
  const n = name.toUpperCase();
  return n.includes("RET") || n.includes("RETORN") || n.includes("ENVASE") || n.includes("VACÍO") || n.includes("VACIO");
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("📦 Leyendo datos raw...");

  const [
    lineasRaw,
    cabeceraRaw,
    direccionesRaw,
    materialesRaw,
    dimensionesRaw,
    horariosRaw,
    geocacheRaw,
  ] = await Promise.all([
    readJson(`${RAW}/raw_lineas_entrega.json`),
    readJson(`${RAW}/raw_cabecera_transporte.json`),
    readJson(`${RAW}/raw_direcciones.json`),
    readJson(`${RAW}/raw_materiales.json`),
    readJson(`${RAW}/raw_dimensiones.json`),
    readJson(`${RAW}/raw_horarios.json`),
    readJson(CACHE).catch(() => ({})),
  ]);

  // ── Geocache: normalizar keys ──────────────────────────────────────────
  const geocache: Record<string, { lat: number; lng: number }> = geocacheRaw;

  function geocodeFromCache(address: string, city: string, cp: string | number): { lat?: number; lng?: number } {
    const key = `${address.toLowerCase()}|${city.toLowerCase()}|${String(cp)}`;
    return geocache[key] ?? {};
  }

  // ── DRIVERS ────────────────────────────────────────────────────────────
  console.log("👤 Procesando repartidores...");

  const driverMap = new Map<number, { id: number; name: string; routes: Set<string>; totalDeliveries: number }>();

  for (const row of lineasRaw as any[]) {
    const id = Number(row.repartidor_id);
    if (!id || isNaN(id)) continue;
    // Buscar nombre en cabecera
    if (!driverMap.has(id)) {
      const cabeceraRow = (cabeceraRaw as any[]).find((r: any) => Number(r.Repartidor) === id);
      const name = cabeceraRow?.["Unnamed: 5"] ?? `Repartidor ${id}`;
      driverMap.set(id, { id, name, routes: new Set(), totalDeliveries: 0 });
    }
    const d = driverMap.get(id)!;
    if (row.ruta) d.routes.add(row.ruta);
    d.totalDeliveries++;
  }

  const drivers = [...driverMap.values()].map(d => ({
    id: d.id,
    name: d.name,
    routes: [...d.routes].sort(),
    totalDeliveries: d.totalDeliveries,
  })).sort((a, b) => a.name.localeCompare(b.name));

  await writeFile(`${OUT}/drivers.json`, JSON.stringify(drivers, null, 2));
  console.log(`  ✓ ${drivers.length} repartidores`);

  // ── ROUTES HISTORY ─────────────────────────────────────────────────────
  console.log("🗺  Procesando historial de rutas...");

  // Geocache por clientId para lookup rápido
  const addrByClient = new Map<number, { address: string; city: string; cp: string }>();
  for (const row of direccionesRaw as any[]) {
    addrByClient.set(Number(row.Cliente), {
      address: row.Calle ?? "",
      city: row.Población ?? row.Poblacion ?? "",
      cp: String(row.CP ?? ""),
    });
  }

  // Agrupar entregas por transporte
  const byTransport = new Map<number, any[]>();
  for (const row of lineasRaw as any[]) {
    const tid = Number(row.transporte);
    if (!byTransport.has(tid)) byTransport.set(tid, []);
    byTransport.get(tid)!.push(row);
  }

  const routesHistory: any[] = [];

  for (const [transportId, rows] of byTransport.entries()) {
    const first = rows[0];
    const driverId = Number(first.repartidor_id);
    const driverInfo = driverMap.get(driverId);

    const stops = rows.map((row: any, idx: number) => {
      const clientId = Number(row.cliente?.codigo);
      const addrInfo = addrByClient.get(clientId) ?? { address: "", city: row.cliente?.poblacion ?? "", cp: String(row.cliente?.cp ?? "") };
      const { lat, lng } = geocodeFromCache(addrInfo.address, addrInfo.city, addrInfo.cp);

      return {
        stopId: `stop-${row.n_entrega}`,
        deliveryId: Number(row.n_entrega),
        sequence: idx + 1,
        clientId,
        clientName: row.cliente?.nombre ?? "",
        address: addrInfo.address || (row.cliente?.nombre ?? ""),
        city: addrInfo.city || (row.cliente?.poblacion ?? ""),
        cp: addrInfo.cp || String(row.cliente?.cp ?? ""),
        lat: lat ?? null,
        lng: lng ?? null,
        items: (row.lineas ?? []).map((l: any) => ({
          material: l.material ?? "",
          descripcion: l.descripcion ?? "",
          cantidad: Number(l.cantidad) || 1,
          unidad: l.unidad ?? "UN",
        })),
      };
    });

    routesHistory.push({
      transportId,
      date: parseDateDDMMYYYY(first.fecha),
      route: first.ruta ?? "",
      driverId,
      driverName: driverInfo?.name ?? `Repartidor ${driverId}`,
      stops,
    });
  }

  routesHistory.sort((a, b) => b.date.localeCompare(a.date));

  await writeFile(`${OUT}/routes-history.json`, JSON.stringify(routesHistory, null, 2));
  console.log(`  ✓ ${routesHistory.length} transportes en historial`);

  // ── CLIENTS ENRICHED ───────────────────────────────────────────────────
  console.log("🏪 Procesando clientes...");

  const scheduleByClient = new Map<number, any[]>();
  for (const row of horariosRaw as any[]) {
    const cid = Number(row.Deudor);
    if (!scheduleByClient.has(cid)) scheduleByClient.set(cid, []);
    scheduleByClient.get(cid)!.push({
      day: Number(row["Día semana"]),
      from: String(row["Horario inicia a"] ?? "00:00:00").slice(0, 5),
      to: String(row["Horario termina a"] ?? "23:59:59").slice(0, 5),
      closed: !!row["Cierre Si/No"],
    });
  }

  const clientsEnriched = (direccionesRaw as any[]).map((row: any) => {
    const clientId = Number(row.Cliente);
    const address = row.Calle ?? "";
    const city = row.Población ?? row.Poblacion ?? "";
    const cp = String(row.CP ?? "");
    const { lat, lng } = geocodeFromCache(address, city, cp);

    return {
      clientId,
      name: row["Nombre 1"] ?? row["Nombre 2"] ?? "",
      address,
      cp,
      city,
      lat: lat ?? null,
      lng: lng ?? null,
      schedule: (scheduleByClient.get(clientId) ?? []).sort((a: any, b: any) => a.day - b.day),
    };
  });

  await writeFile(`${OUT}/clients-enriched.json`, JSON.stringify(clientsEnriched, null, 2));
  console.log(`  ✓ ${clientsEnriched.length} clientes`);

  // ── MATERIALS ENRICHED ────────────────────────────────────────────────
  console.log("📦 Procesando materiales...");

  // Índice de dimensiones por material+UMA
  type DimKey = string;
  const dimMap = new Map<DimKey, any>();
  for (const row of dimensionesRaw as any[]) {
    const key = `${row.Material}::${row.UMA}`;
    dimMap.set(key, row);
  }

  const materialsEnriched = (materialesRaw as any[]).map((row: any) => {
    const mid = row.Material ?? "";
    const name = row["Número de material"] ?? "";
    const unit = row.UMB ?? "UN";

    // Buscar dimensiones: primero CAJ, luego UN, luego cualquiera
    const dimCaj = dimMap.get(`${mid}::CAJ`);
    const dimUn  = dimMap.get(`${mid}::UN`);
    const dim    = dimCaj ?? dimUn ?? null;

    let dimensions: any = undefined;
    if (dim && (dim.Longitud > 0 || dim.Ancho > 0 || dim.Altura > 0)) {
      dimensions = {
        lengthCm: Number(dim.Longitud) || 0,
        widthCm: Number(dim.Ancho) || 0,
        heightCm: Number(dim.Altura) || 0,
        weightKg: Number(dim["Peso bruto"]) || 0,
        unitsPerBox: Number(dim.Contador) || 1,
      };
    }

    return {
      materialId: mid,
      name,
      warehouseLocation: row["Ubic."] ?? "",
      unitBase: unit,
      dimensions,
      handlingType: inferHandlingType(name, unit),
      returnable: inferReturnable(name),
    };
  });

  await writeFile(`${OUT}/materials-enriched.json`, JSON.stringify(materialsEnriched, null, 2));
  console.log(`  ✓ ${materialsEnriched.length} materiales`);

  console.log("\n✅ ETL completado. Ficheros en data/processed/");
}

main().catch(e => { console.error("❌ ETL error:", e); process.exit(1); });
