import { test } from "node:test";
import assert from "node:assert/strict";

import { optimizeLoad } from "../src/optimizeLoad.js";
import { mockInputData } from "../src/mock/mockInputData.js";
import { mockRoutePlan } from "../src/mock/mockRoutePlan.js";

test("optimizeLoad: produce a LoadPlan with one slot per pallet", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  assert.equal(plan.palletSlots.length, mockInputData.vehicle.palletSlots);
  assert.equal(plan.strategy, "hybrid_by_route_blocks");
  assert.equal(plan.vehicleId, mockInputData.vehicle.id);
});

test("optimizeLoad: reserva un slot para retornables", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  assert.ok(
    plan.returnablesPlan.reservedSlots.length >= 1,
    "Debe haber al menos un slot reservado para retornables",
  );
  const reservedSlot = plan.palletSlots.find(
    (s) => s.slotId === plan.returnablesPlan.reservedSlots[0],
  );
  assert.equal(reservedSlot?.accessPriority, "returnables");
});

test("optimizeLoad: barriles van al layer bottom", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  const barrels = plan.palletSlots
    .flatMap((s) => s.items)
    .filter((i) => i.handlingType === "keg");
  assert.ok(barrels.length > 0, "El mock debe contener al menos un barril");
  for (const b of barrels) {
    assert.equal(
      b.layer,
      "bottom",
      `Barril ${b.productId} debería estar en layer bottom (estaba en ${b.layer})`,
    );
  }
});

test("optimizeLoad: paradas tempranas asignadas a slots high access", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  const earlyStops = mockRoutePlan.stops.filter((s) => s.sequence <= 4);
  for (const es of earlyStops) {
    const slotsForStop = plan.palletSlots.filter((sl) =>
      sl.items.some((i) => i.stopId === es.stopId),
    );
    const anyAccessible = slotsForStop.some(
      (sl) =>
        sl.accessPriority === "high" || sl.accessPriority === "medium",
    );
    assert.ok(
      anyAccessible,
      `La parada temprana ${es.stopId} debería tener al menos un slot accesible`,
    );
  }
});

test("optimizeLoad: KPIs en rango [0,1]", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  for (const [k, v] of Object.entries(plan.kpis)) {
    assert.ok(
      typeof v === "number" && v >= 0 && v <= 1,
      `KPI ${k} fuera de rango: ${v}`,
    );
  }
});

test("optimizeLoad: cada item se asigna como mucho a un slot", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  const totalLoaded = plan.palletSlots.reduce(
    (acc, s) => acc + s.items.length,
    0,
  );
  const totalSourceItems = mockInputData.orders.reduce(
    (acc, o) => acc + o.items.length,
    0,
  );
  // Pueden no asignarse todos si hay overflow extremo, pero con el mock
  // realista esperamos que todos quepan.
  assert.equal(
    totalLoaded,
    totalSourceItems,
    `Esperaban ${totalSourceItems} items cargados, hay ${totalLoaded}`,
  );
});

test("optimizeLoad: warnings y explicación no vacíos", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  assert.ok(plan.warnings.length > 0);
  assert.ok(plan.explanation.length > 0);
});

test("optimizeLoad: cada slot tiene routeBlock asignado salvo retornables", () => {
  const plan = optimizeLoad(mockInputData, mockRoutePlan);
  for (const slot of plan.palletSlots) {
    if (slot.accessPriority === "returnables") continue;
    assert.ok(
      slot.routeBlock,
      `Slot ${slot.slotId} debería estar asociado a un routeBlock`,
    );
  }
});
