/**
 * Pipeline 100% real — sin mocks.
 * 1. buildRealInput  → construye InputPayload desde los 7 archivos raw de Damm
 * 2. validateInput   → verifica el contrato Zod
 * 3. optimizeRoute   → calcula la ruta óptima
 * 4. Guarda routePlan-output.json para Persona 5
 */
import * as fs from "fs";
import * as path from "path";
import { buildRealInput } from "./data/buildRealInput";
import { validateInput } from "./validation/inputValidator";
import { optimizeRoute } from "./optimizeRoute";

// ── 1. Construir input real ───────────────────────────────────────────────────
// Transporte 11624184 — JOSE MARIA SORIA JURADO — 30/03/2026 — 16 paradas
// Cambia nTransporte para probar cualquier otro transporte del histórico SAP

const transporteNum = Number(process.argv[2]) || 11624184;
console.log(`\n🔄 Construyendo input real para transporte ${transporteNum}...`);

const rawInput = buildRealInput({ nTransporte: transporteNum });
console.log(`✅ Input construido — ${rawInput.stops.length} stops | repartidor: ${rawInput.driver.name}`);

// ── 2. Validar ────────────────────────────────────────────────────────────────
const validation = validateInput(rawInput);
if (!validation.valid) {
  console.error("\n❌ Validación fallida:");
  for (const err of validation.errors) console.error(`  [${err.path}] ${err.message}`);
  process.exit(1);
}
const input = validation.data;

// ── 3. Optimizar ─────────────────────────────────────────────────────────────
const t0 = Date.now();
const result = optimizeRoute(input);
const elapsed = Date.now() - t0;

// ── 4. Output ─────────────────────────────────────────────────────────────────
console.log(`\n⚡ optimizeRoute completado en ${elapsed}ms`);

console.log(`\n📋 Carga ${result.loadId} — ${result.deliveryDate}`);
console.log(`   Repartidor: ${result.driver.name}`);
console.log(`   Vehículo:   ${result.vehicle.plate} (${result.vehicle.palletSlots} slots)`);

console.log(`\n📊 KPIs`);
console.log(`   Paradas planificadas:  ${result.meta.stopsPlanned}/${result.meta.stopsRequested}`);
console.log(`   Paradas saltadas:      ${result.meta.stopsSkipped}`);
console.log(`   Distancia total:       ${result.kpis.totalDistanceKm} km`);
console.log(`   Tiempo conducción:     ${result.kpis.totalDriveMinutes} min`);
console.log(`   Tiempo servicio:       ${result.kpis.totalServiceMinutes} min`);
console.log(`   Tiempo espera:         ${result.kpis.totalWaitMinutes} min`);
console.log(`   Cobro total:           ${result.kpis.totalCollectionEur} €`);
console.log(`   Adherencia ventanas:   ${result.kpis.routeAdherencePct}%`);
console.log(`   Retorno depósito ETA:  ${result.returnToDepotEta.estimated}`);

console.log(`\n📈 Comparativa baseline vs optimizado`);
console.log(`   Baseline:   ${result.comparison.baseline.km} km | ${result.comparison.baseline.minutes} min`);
console.log(`   Optimizado: ${result.comparison.optimized.km} km | ${result.comparison.optimized.minutes} min`);
const savingsKm  = result.comparison.savings.km;
const savingsMin = result.comparison.savings.minutes;
const savingsPct = result.comparison.savings.percentage;
console.log(`   Ahorro:     ${savingsKm > 0 ? "-" : "+"}${Math.abs(savingsKm)} km | ${savingsMin > 0 ? "-" : "+"}${Math.abs(savingsMin)} min | ${savingsPct}%`);

console.log(`\n📍 Orden de paradas:`);
for (const s of result.stops) {
  const badge   = s.paymentType === "CONTADO" ? "💶" : "  ";
  const conf    = input.stops.find((p) => p.id === s.stopId)?.historicalConfidence ?? 0;
  const barrels = result.loadingOrder.find((l) => l.stopId === s.stopId)?.barrels ?? 0;
  const brlTag  = barrels > 0 ? ` 🛢${barrels}` : "";
  console.log(`  ${String(s.sequence).padStart(2)} ${badge} ${s.eta.estimated} · ${s.clientName.padEnd(35)} ${s.city.padEnd(20)} conf:${Math.round(conf * 100)}%${brlTag}`);
  for (const r of s.reasoning) {
    const icon = r.type === "positive" ? "✓" : r.type === "warning" ? "⚠" : "·";
    console.log(`       ${icon} ${r.text}`);
  }
}

if (result.driverBreaks.length > 0) {
  console.log(`\n⏸  Pausas EU 561/2006:`);
  for (const b of result.driverBreaks) {
    console.log(`   Tras parada ${b.afterSequence}: ${b.durationMin} min`);
  }
}

console.log(`\n🚚 Orden carga LIFO (primero en subir = último en entregar):`);
for (const li of result.loadingOrder) {
  console.log(`  Pos ${String(li.loadingPosition).padStart(2)}: ${li.clientName.padEnd(35)} ${li.palletUnits}pu | ${li.warehouseLocations.join(", ")}`);
  if (li.barrels > 0) console.log(`        ↑ ${li.barrels} barril(es) — al fondo, usar transpaleta`);
}

const outPath = path.resolve(__dirname, "../../../data/routePlan-output.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\n💾 routePlan guardado → data/routePlan-output.json`);
console.log(`\nUso: npm run dev [nTransporte]  (ej: npm run dev 11624127)`);
