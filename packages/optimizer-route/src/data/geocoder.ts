/**
 * Geocodificación de direcciones Damm via Nominatim (OpenStreetMap, gratuito).
 * Rate limit: 1 req/s. Cachea en disco para no re-geocodificar entre ejecuciones.
 *
 * En producción sustituir por Google Geocoding API para mayor precisión en España.
 */
import * as fs from "fs";
import * as path from "path";

const CACHE_PATH         = path.resolve(__dirname, "../../../../data/geocode-cache.json");
const PARKING_CACHE_PATH = path.resolve(__dirname, "../../../../data/parking-cache.json");
const NOMINATIM_BASE     = "https://nominatim.openstreetmap.org";
const USER_AGENT         = "DammOptimizerRoute/1.0 (hackathon; contact@damm.es)";

interface GeoPoint { lat: number; lng: number }
type GeoCache     = Record<string, GeoPoint | null>;
type ParkingCache = Record<string, string | null>;  // centroid key → display name

let _geoCache: GeoCache | null     = null;
let _parkCache: ParkingCache | null = null;

function loadGeoCache(): GeoCache {
  if (_geoCache) return _geoCache;
  try { _geoCache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")); }
  catch { _geoCache = {}; }
  return _geoCache!;
}

function loadParkCache(): ParkingCache {
  if (_parkCache) return _parkCache;
  try { _parkCache = JSON.parse(fs.readFileSync(PARKING_CACHE_PATH, "utf-8")); }
  catch { _parkCache = {}; }
  return _parkCache!;
}

function saveGeoCache(c: GeoCache):     void { fs.writeFileSync(CACHE_PATH,         JSON.stringify(c, null, 2)); }
function saveParkCache(c: ParkingCache): void { fs.writeFileSync(PARKING_CACHE_PATH, JSON.stringify(c, null, 2)); }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Nominatim helpers ─────────────────────────────────────────────────────────

async function nominatimForward(address: string, city: string): Promise<GeoPoint | null> {
  const q   = encodeURIComponent(`${address}, ${city}, España`);
  const url = `${NOMINATIM_BASE}/search?q=${q}&format=json&limit=1&countrycodes=es`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any[];
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch { return null; }
}

async function nominatimReverse(lat: number, lng: number): Promise<string | null> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const addr = data?.address;
    if (!addr) return null;
    const road = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? null;
    const town = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
    return road ? `${road}, ${town}`.trim() : town || null;
  } catch { return null; }
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface GeocodeOptions {
  rateLimitMs?: number;
  verbose?: boolean;
}

/** Geocodifica paradas con caché en disco. Hace requests solo para las que faltan. */
export async function geocodeStops(
  stops: Array<{ id: string; address: string; city: string; postalCode: string }>,
  opts: GeocodeOptions = {}
): Promise<Map<string, GeoPoint | null>> {
  const { rateLimitMs = 1100, verbose = false } = opts;
  const cache  = loadGeoCache();
  const result = new Map<string, GeoPoint | null>();
  let newEntries = 0;

  for (const stop of stops) {
    const key = `${stop.address}|${stop.city}|${stop.postalCode}`.toLowerCase();
    if (key in cache) { result.set(stop.id, cache[key]); continue; }

    if (verbose) process.stdout.write(`  🌍 ${stop.address}, ${stop.city}... `);
    const point = await nominatimForward(stop.address, `${stop.city} ${stop.postalCode}`);
    cache[key] = point;
    result.set(stop.id, point);
    newEntries++;
    if (verbose) console.log(point ? `✓ (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})` : "✗");
    await sleep(rateLimitMs);
  }

  if (newEntries > 0) { saveGeoCache(cache); }
  return result;
}

/** Solo caché — no hace requests. Para el pipeline síncrono en buildRealInput. */
export function geocodeCached(
  stops: Array<{ id: string; address: string; city: string; postalCode: string }>
): Map<string, GeoPoint | null> {
  const cache  = loadGeoCache();
  const result = new Map<string, GeoPoint | null>();
  for (const stop of stops) {
    const key = `${stop.address}|${stop.city}|${stop.postalCode}`.toLowerCase();
    result.set(stop.id, cache[key] ?? null);
  }
  return result;
}

// ── Parking points (reverse geocode del centroide del cluster) ────────────────

export interface ClusterParkingInput {
  id: string;
  centroidLat: number;
  centroidLng: number;
  stopCount: number;
  city: string;
}

/**
 * Resuelve el nombre real del punto de aparcamiento de cada cluster via reverse
 * geocode del centroide. El camionero ve "Av. Dos de Mayo, Parets" en lugar de
 * coordenadas. Guarda en caché separada para no repetir entre ejecuciones.
 */
export async function resolveParkingPoints(
  clusters: ClusterParkingInput[],
  opts: GeocodeOptions = {}
): Promise<Map<string, string>> {
  const { rateLimitMs = 1100, verbose = false } = opts;
  const cache  = loadParkCache();
  const result = new Map<string, string>();
  let newEntries = 0;

  for (const c of clusters) {
    const key = `${c.centroidLat.toFixed(5)}|${c.centroidLng.toFixed(5)}`;

    if (key in cache) {
      result.set(c.id, cache[key] ?? fallbackParkingName(c));
      continue;
    }

    if (verbose) process.stdout.write(`  📍 Cluster ${c.id} (${c.stopCount} clientes)... `);
    const name = await nominatimReverse(c.centroidLat, c.centroidLng);
    cache[key] = name;
    result.set(c.id, name ? formatParkingName(name, c.stopCount) : fallbackParkingName(c));
    newEntries++;
    if (verbose) console.log(name ?? "(sin resultado)");
    await sleep(rateLimitMs);
  }

  if (newEntries > 0) { saveParkCache(cache); }
  return result;
}

/** Solo caché — devuelve null si no está resuelto aún. */
export function parkingPointsCached(
  clusters: ClusterParkingInput[]
): Map<string, string | null> {
  const cache  = loadParkCache();
  const result = new Map<string, string | null>();
  for (const c of clusters) {
    const key  = `${c.centroidLat.toFixed(5)}|${c.centroidLng.toFixed(5)}`;
    const raw  = cache[key];
    result.set(c.id, raw !== undefined ? (raw ? formatParkingName(raw, c.stopCount) : null) : null);
  }
  return result;
}

function formatParkingName(street: string, stopCount: number): string {
  return stopCount > 1
    ? `Zona descarga — ${street} (${stopCount} clientes)`
    : `Zona descarga — ${street}`;
}

function fallbackParkingName(c: ClusterParkingInput): string {
  return c.stopCount > 1
    ? `Zona aparcamiento, ${c.city} (${c.stopCount} clientes)`
    : `Zona aparcamiento, ${c.city}`;
}
