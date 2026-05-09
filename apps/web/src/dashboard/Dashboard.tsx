/**
 * Damm Smart Truck Copilot - Demo dashboard.
 *
 * Layout:
 *
 *   Header   : marca + modos (conductor/almacen/supervisor) + estado API
 *   Center   : izquierda Comandas + Copilot | derecha solo camion 3D
 *   Below    : RoutePanel + WarningsPanel + StrategyComparator
 *
 * El nucleo del demo es la herramienta del conductor: la `TruckStage`
 * con sus 8 palets en 3D, el highlight de la entrega activa, los popups
 * de detalle y el "vaciado" del camion conforme se entregan paradas.
 */
import { useEffect, useMemo, useState } from "react";
import type { CopilotResponse } from "@damm/copilot";
import { RoutePanel } from "./RoutePanel";
import { CopilotChat } from "./CopilotChat";
import { WarningsPanel } from "./WarningsPanel";
import { StrategyComparator } from "./StrategyComparator";
import { TruckStage } from "./truck3d/TruckStage";
import { DeliveryQueue } from "./truck3d/DeliveryQueue";
import type { ViewMode } from "./truck3d/TruckView3D";
import { buildHybrid, buildTraditional } from "../lib/pipeline";
import { checkApiHealth } from "../lib/copilotClient";
import styles from "./Dashboard.module.css";

type Mode = "driver" | "warehouse" | "supervisor";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "driver", label: "Conductor" },
  { id: "warehouse", label: "Almacen" },
  { id: "supervisor", label: "Supervisor" },
];

export function Dashboard() {
  const hybrid = useMemo(() => buildHybrid(), []);
  const traditional = useMemo(() => buildTraditional(), []);

  const [mode, setMode] = useState<Mode>("driver");
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const [currentStopId, setCurrentStopId] = useState<string>(
    hybrid.routePlan.stops[0]?.stopId ?? "",
  );
  const [deliveredStopIds, setDeliveredStopIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [truckViewMode, setTruckViewMode] = useState<ViewMode>("general");

  useEffect(() => {
    void checkApiHealth().then(setApiUp);
    const id = setInterval(() => {
      void checkApiHealth().then(setApiUp);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  function handleCopilotAction(action: CopilotResponse["actions"][number]) {
    if (action.type === "highlight_stop") {
      setCurrentStopId(action.stopId);
    }
    if (action.type === "highlight_truck_slot") {
      setSelectedSlotId(action.slotId);
    }
  }

  function handleConfirmDelivery(stopId: string) {
    // Marcar la parada como entregada y avanzar a la siguiente.
    setDeliveredStopIds((prev) => {
      const next = new Set(prev);
      next.add(stopId);
      return next;
    });
    const sortedStops = [...hybrid.routePlan.stops].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const idx = sortedStops.findIndex((s) => s.stopId === stopId);
    const nextStop = sortedStops
      .slice(idx + 1)
      .find((s) => !deliveredStopIds.has(s.stopId));
    if (nextStop) {
      setCurrentStopId(nextStop.stopId);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>D</span>
          <div className={styles.brandText}>
            <h1>Damm Smart Truck Copilot</h1>
            <p>
              Reparto DR0027 · {hybrid.inputData.driver?.name ?? "(sin conductor)"} ·
              vehiculo {hybrid.inputData.vehicle.id} ·
              {" "}
              {deliveredStopIds.size}/{hybrid.routePlan.stops.length} entregadas
            </p>
          </div>
        </div>

        <div className={styles.modes} role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              className={styles.modeBtn}
              data-active={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className={styles.statusGroup}>
          <span
            className={styles.statusDot}
            data-ok={apiUp === true}
            title={
              apiUp === true
                ? "API en :3001 disponible"
                : apiUp === false
                  ? "API caida (modo offline / in-browser)"
                  : "comprobando..."
            }
          >
            API {apiUp === true ? "ON" : apiUp === false ? "OFF" : "…"}
          </span>
          <span className={styles.statusDot} data-ok={true}>
            optimizer-route
          </span>
          <span className={styles.statusDot} data-ok={true}>
            optimizer-load
          </span>
          <span className={styles.statusDot} data-ok={true}>
            copilot
          </span>
        </div>
      </header>

      <section className={styles.mainTruck}>
        <div className={styles.driverLeft}>
          <DeliveryQueue
            routePlan={hybrid.routePlan}
            inputData={hybrid.inputData}
            loadPlan={hybrid.loadPlan}
            currentStopId={currentStopId}
            deliveredStopIds={deliveredStopIds}
            compact
            onSelectStop={(stopId) => {
              setCurrentStopId(stopId);
              if (truckViewMode === "general") setTruckViewMode("next-stop");
            }}
            onConfirmDelivery={handleConfirmDelivery}
          />
          <CopilotChat
            className={styles.copilotSidebar}
            currentStopId={currentStopId}
            routePlan={hybrid.routePlan}
            loadPlan={hybrid.loadPlan}
            inputData={hybrid.inputData}
            onAction={handleCopilotAction}
          />
        </div>

        <div className={styles.truckMainColumn}>
          <TruckStage
            loadPlan={hybrid.loadPlan}
            currentStopId={currentStopId}
            deliveredStopIds={deliveredStopIds}
            selectedSlotId={selectedSlotId}
            viewMode={truckViewMode}
            onSelectSlot={setSelectedSlotId}
            onChangeMode={setTruckViewMode}
          />
        </div>
      </section>

      <section className={styles.mainBelow}>
        <RoutePanel
          routePlan={hybrid.routePlan}
          inputData={hybrid.inputData}
          currentStopId={currentStopId}
          onSelectStop={setCurrentStopId}
        />
        <WarningsPanel warnings={filterByMode(mode, hybrid.loadPlan.warnings)} />
        <StrategyComparator
          hybrid={hybrid.loadPlan}
          traditional={traditional.loadPlan}
        />
      </section>
    </div>
  );
}

function filterByMode(
  mode: Mode,
  warnings: ReturnType<typeof buildHybrid>["loadPlan"]["warnings"],
) {
  if (mode === "warehouse") {
    return warnings.filter((w) =>
      ["heavy_item", "stacking", "missing_data", "capacity"].includes(w.type),
    );
  }
  if (mode === "driver") {
    return warnings.filter((w) =>
      ["access", "returnables", "capacity"].includes(w.type),
    );
  }
  return warnings;
}

export default Dashboard;
