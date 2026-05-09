/**
 * Geocodifica todas las direcciones únicas de clients-enriched.json
 * usando la Mapbox Geocoding API, con rate limiting y cache persistente.
 *
 * Uso: VITE_MAPBOX_TOKEN=pk.xxx npx tsx scripts/geocode.ts
 *
 * El cache se guarda en data/geocode-cache.json tras cada lote.
 * Si se interrumpe, se puede relanzar y continuará desde donde dejó.
 */
import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT  = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = resolve(ROOT, "data/geocode-cache.json");
const PROCESSED = resolve(ROOT, "data/processed");

const TOKEN = process.env.VITE_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN ?? "";
const BATCH = 5;    // requests simultáneas
const DELAY = 200;  // ms entre lotes

async function readJsonFixed(path: string) {
  const txt = await readFile(path, "utf8");
  return JSON.parse(txt.replace(/:\s*NaN/g, ": null").replace(/:\s*Infinity/g, ": null"));
}

async function geocode(address: string, city: string, cp: string): Promise<{ lat: number; lng: number } | null> {
  if (!TOKEN) return null;
  const query = encodeURIComponent(`${address}, ${cp} ${city}, Spain`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${TOKEN}&country=ES&limit=1&language=es`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as any;
    const feature = data.features?.[0];
    if (!feature) return null;
    return { lng: feature.center[0], lat: feature.center[1] };
  } catch {
    return null;
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!TOKEN) {
    console.error("❌ Falta VITE_MAPBOX_TOKEN o MAPBOX_TOKEN");
    process.exit(1);
  }

  console.log("🗺  Iniciando geocodificación batch...");

  // Cargar cache existente
  let cache: Record<string, { lat: number; lng: number }> = {};
  try {
    const txt = await readFile(CACHE, "utf8");
    cache = JSON.parse(txt);
  } catch { /* empty cache */ }

  // Cargar clientes
  const clients = await readJsonFixed(`${PROCESSED}/clients-enriched.json`) as any[];

  // Filtrar los que no tienen coords en cache
  const toGeocode: Array<{ key: string; address: string; city: string; cp: string }> = [];
  for (const client of clients) {
    if (!client.address || !client.city) continue;
    const key = `${client.address.toLowerCase()}|${client.city.toLowerCase()}|${client.cp}`;
    if (cache[key]) continue;
    toGeocode.push({ key, address: client.address, city: client.city, cp: client.cp });
  }

  console.log(`  ${Object.keys(cache).length} ya en cache · ${toGeocode.length} pendientes de geocodificar`);

  if (toGeocode.length === 0) {
    console.log("✅ Todos los clientes ya están geocodificados.");
    // Reconstruir routes-history con coords actualizadas
    await enrichRoutesWithCoords(cache);
    return;
  }

  let done = 0;
  let found = 0;
  const total = toGeocode.length;

  for (let i = 0; i < toGeocode.length; i += BATCH) {
    const batch = toGeocode.slice(i, i + BATCH);

    const results = await Promise.all(
      batch.map(async (item) => ({
        key: item.key,
        coords: await geocode(item.address, item.city, item.cp),
      }))
    );

    for (const { key, coords } of results) {
      if (coords) {
        cache[key] = coords;
        found++;
      }
      done++;
    }

    // Guardar cache cada lote
    await writeFile(CACHE, JSON.stringify(cache, null, 2));

    if (done % 50 === 0 || done === total) {
      const pct = Math.round(done / total * 100);
      process.stdout.write(`\r  Progreso: ${done}/${total} (${pct}%) · encontradas: ${found}`);
    }

    if (i + BATCH < toGeocode.length) await sleep(DELAY);
  }

  console.log(`\n✅ Geocodificación completa: ${found}/${total} resueltas`);

  // Reconstruir routes-history con coords actualizadas
  await enrichRoutesWithCoords(cache);
}

async function enrichRoutesWithCoords(cache: Record<string, { lat: number; lng: number }>) {
  console.log("\n🔄 Actualizando routes-history.json con coordenadas...");

  const routes = await readJsonFixed(`${PROCESSED}/routes-history.json`) as any[];
  let updated = 0;

  // Cargar clients para mapeo clientId → dirección
  const clients = await readJsonFixed(`${PROCESSED}/clients-enriched.json`) as any[];
  const clientMap = new Map(clients.map((c: any) => [c.clientId, c]));

  for (const route of routes) {
    for (const stop of route.stops) {
      if (stop.lat && stop.lat !== 0) continue; // ya tiene

      const client = clientMap.get(stop.clientId) as any;
      if (!client) continue;

      const key = `${client.address.toLowerCase()}|${client.city.toLowerCase()}|${client.cp}`;
      const coords = cache[key];
      if (coords) {
        stop.lat = coords.lat;
        stop.lng = coords.lng;
        updated++;
      }
    }
  }

  await writeFile(`${PROCESSED}/routes-history.json`, JSON.stringify(routes, null, 2));
  console.log(`  ✓ ${updated} paradas actualizadas con coordenadas`);

  // Actualizar también clients-enriched
  let clientsUpdated = 0;
  for (const client of clients) {
    if (client.lat) continue;
    const key = `${client.address.toLowerCase()}|${client.city.toLowerCase()}|${client.cp}`;
    const coords = cache[key];
    if (coords) {
      client.lat = coords.lat;
      client.lng = coords.lng;
      clientsUpdated++;
    }
  }
  await writeFile(`${PROCESSED}/clients-enriched.json`, JSON.stringify(clients, null, 2));
  console.log(`  ✓ ${clientsUpdated} clientes con coordenadas actualizadas`);

  // Stats finales
  const withCoords = routes.reduce((s: number, r: any) => s + r.stops.filter((st: any) => st.lat && st.lat !== 0).length, 0);
  const total = routes.reduce((s: number, r: any) => s + r.stops.length, 0);
  console.log(`\n📊 Resultado final: ${withCoords}/${total} paradas con coordenadas (${Math.round(withCoords/total*100)}%)`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
