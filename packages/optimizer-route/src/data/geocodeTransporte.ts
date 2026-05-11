/**
 * Script one-shot: geocodifica paradas Y resuelve puntos de aparcamiento por cluster.
 * Ejecutar UNA VEZ antes de `npm run dev` para tener coords y parking reales.
 *
 * Uso: npx ts-node src/data/geocodeTransporte.ts [nTransporte]
 *
 * Genera dos cachés en data/:
 *   geocode-cache.json  → coordenadas de cada dirección
 *   parking-cache.json  → nombre de calle del centroide de cada cluster
 */
import { buildRealInput } from "./buildRealInput";
import { geocodeStops, resolveParkingPoints } from "./geocoder";
import { clusterStops } from "../geo/clustering";
import { enrichStopsForClustering } from "./enrichStopsForClustering";

const nTransporte = Number(process.argv[2]) || 11624184;
const totalStops = 14; // estimado para el mensaje de tiempo

console.log(`\n🌍 Geocodificando transporte ${nTransporte}...`);
console.log(`   Paso 1/2: coordenadas de paradas (~${totalStops}s)\n`);

(async () => {
  // ── 1. Geocodificar direcciones ──────────────────────────────────────────────
  const input = buildRealInput({ nTransporte });

  const geoResult = await geocodeStops(
    input.stops.map((s) => ({
      id: s.id,
      address: s.address,
      city: s.city,
      postalCode: s.postalCode,
    })),
    { verbose: true }
  );

  const foundCoords  = [...geoResult.values()].filter(Boolean).length;
  const missingCoords = [...geoResult.values()].filter((v) => !v).length;
  console.log(`\n   ✅ Coordenadas: ${foundCoords} resueltas, ${missingCoords} fallback`);

  // ── 2. Resolver nombres de parking points ─────────────────────────────────
  // Necesitamos hacer clustering con las coords reales ya en caché.
  // Reconstruimos el input (ahora usará las coords geocodificadas desde caché).
  console.log(`\n   Paso 2/2: puntos de aparcamiento por cluster...\n`);

  const inputWithRealCoords = buildRealInput({ nTransporte });
  const enriched = enrichStopsForClustering(inputWithRealCoords);
  const { clusters } = clusterStops(enriched);

  const clusterInputs = clusters.map((c) => ({
    id:           c.id,
    centroidLat:  c.centroidLat,
    centroidLng:  c.centroidLng,
    stopCount:    c.stopIds.length,
    city: enriched.find((e) => e.stop.id === c.stopIds[0])?.stop.city ?? "",
  }));

  await resolveParkingPoints(clusterInputs, { verbose: true });

  console.log(`\n✅ Geocodificación completa:`);
  console.log(`   ${clusters.length} clusters resueltos`);
  for (const c of clusters) {
    const stops = c.stopIds.map((sid) => {
      const s = inputWithRealCoords.stops.find((st) => st.id === sid);
      return s?.clientName ?? sid;
    });
    console.log(`   ${c.id}: ${c.parkingPointName}`);
    for (const name of stops) console.log(`     · ${name}`);
  }

  console.log(`\n→ Ahora ejecuta: npm run dev ${nTransporte}`);
})().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
