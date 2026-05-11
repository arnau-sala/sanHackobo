/**
 * Script de demo: ejecuta el motor de carga con los mocks y pinta el LoadPlan
 * por consola en formato amigable.
 *
 *   npm run demo
 */

import { optimizeLoad } from "./optimizeLoad.js";
import { mockInputData } from "./mock/mockInputData.js";
import { mockRoutePlan } from "./mock/mockRoutePlan.js";
import type { LoadPlan } from "./types.js";

const loadPlan = optimizeLoad(mockInputData, mockRoutePlan);

printLoadPlan(loadPlan);

// También exponemos el JSON crudo para inspección / pipe a archivo:
//   npm run demo > loadplan.json
if (process.argv.includes("--json")) {
  process.stdout.write("\n----- JSON -----\n");
  process.stdout.write(JSON.stringify(loadPlan, null, 2));
  process.stdout.write("\n");
}

function printLoadPlan(plan: LoadPlan): void {
  const line = (s = "") => process.stdout.write(s + "\n");
  const hr = () =>
    line(
      "─".repeat(64),
    );

  hr();
  line(`DAMM SMART TRUCK COPILOT — LoadPlan ${plan.vehicleId}`);
  line(`Estrategia: ${plan.strategy}`);
  hr();

  line("Bloques de ruta:");
  for (const b of plan.routeBlocks) {
    line(
      `  ${b.name.padEnd(10)} secuencia ${b.sequenceRange.from}-${b.sequenceRange.to.toString().padEnd(2)}  slots ${b.assignedSlots.join(", ")}`,
    );
  }
  hr();

  line("Slots:");
  for (const s of plan.palletSlots) {
    const fill = ((s.fillRatio ?? 0) * 100).toFixed(0).padStart(3);
    const v = (s.usedVolume ?? 0).toFixed(2);
    const w = (s.usedWeight ?? 0).toFixed(0);
    line(
      `  ${s.slotId} ${s.side.padEnd(6)} ${s.accessPriority.padEnd(11)} ${s.reservedFor?.padEnd(11)} fill ${fill}%  vol ${v} m³  peso ${w} kg  items ${s.items.length}`,
    );
    for (const it of s.items) {
      const tag = it.returnable ? "♻" : " ";
      line(
        `      ${tag} sec.${it.sequence.toString().padStart(2)} ${it.clientName.padEnd(35)} ${it.quantity}x ${it.unit.padEnd(8)} ${it.productId.padEnd(10)} [${it.layer}]  ${it.name}`,
      );
    }
  }
  hr();

  line("Retornables:");
  line(
    `  Slots reservados: ${plan.returnablesPlan.reservedSlots.join(", ") || "—"}`,
  );
  line(
    `  Volumen estimado retorno: ${plan.returnablesPlan.estimatedReturnableVolume} m³`,
  );
  line(
    `  Peso estimado retorno: ${plan.returnablesPlan.estimatedReturnableWeight} kg`,
  );
  for (const n of plan.returnablesPlan.notes) line(`  - ${n}`);
  hr();

  line("KPIs:");
  for (const [k, v] of Object.entries(plan.kpis)) {
    line(`  ${k.padEnd(30)} ${typeof v === "number" ? v.toFixed(2) : v}`);
  }
  hr();

  line("Warnings:");
  for (const w of plan.warnings) {
    const sev = `[${w.severity.toUpperCase()}]`;
    line(`  ${sev.padEnd(11)} ${w.type.padEnd(13)} ${w.message}`);
  }
  hr();

  line("Explicación:");
  for (const e of plan.explanation) line(`  • ${e}`);
  hr();
}
