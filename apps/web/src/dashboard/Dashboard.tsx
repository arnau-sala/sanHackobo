/**
 * Damm Smart Truck Copilot - Dashboard para conductor.
 *
 * Pensado como herramienta REAL para un camionero experto de Damm:
 *   - Progreso visual de la ruta en el header
 *   - Reloj en tiempo real
 *   - Camión 3D grande y claro en el centro
 *   - Comandas con la parada activa prominente a la derecha
 *   - Copiloto IA solo por voz (el conductor conduce)
 *   - Ruta con paradas a la izquierda
 */
import { useEffect, useMemo, useState } from "react";
import type { CopilotResponse } from "@damm/copilot";
import { RoutePanel } from "./RoutePanel";
import { CopilotChat } from "./CopilotChat";
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
  const _traditional = useMemo(() => buildTraditional(), []);

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
  const [clock, setClock] = useState(() => formatClock());
  
  // Novedades de conductor experto
  const [highContrast, setHighContrast] = useState(false);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => {
      setClock(formatClock());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void checkApiHealth().then(setApiUp);
    const id = setInterval(() => {
      void checkApiHealth().then(setApiUp);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  // Current stop info for the header banner
  const currentStop = useMemo(() => {
    const rs = hybrid.routePlan.stops.find((s) => s.stopId === currentStopId);
    const stop = hybrid.inputData.stops.find((s) => s.id === currentStopId);
    
    return { rs, stop };
  }, [hybrid, currentStopId]);

  const totalStops = hybrid.routePlan.stops.length;
  const deliveredCount = deliveredStopIds.size;
  const progressPct = totalStops > 0 ? (deliveredCount / totalStops) * 100 : 0;

  function handleCopilotAction(action: CopilotResponse["actions"][number]) {
    if (action.type === "highlight_stop") {
      setCurrentStopId(action.stopId);
    }
    if (action.type === "highlight_truck_slot") {
      setSelectedSlotId(action.slotId);
    }
  }

  function handleConfirmDelivery(stopId: string) {
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
    <div className={styles.shell} data-theme={highContrast ? "high-contrast" : "dark"}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.brand}>
            <span className={styles.logo}>D</span>
            <div className={styles.brandText}>
              <h1>Damm Smart Truck Copilot</h1>
              <p>
                {hybrid.inputData.driver?.name ?? "Conductor"} · {hybrid.inputData.vehicle.id}
              </p>
            </div>
          </div>

          {/* Live progress */}
          <div className={styles.progressBlock}>
            <div className={styles.progressInfo}>
              <span className={styles.progressLabel}>
                🚛 {deliveredCount}/{totalStops} entregas
              </span>
              <span className={styles.progressPct}>{Math.round(progressPct)}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>



        <div className={styles.headerRight}>
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

          <div className={styles.clockBlock}>
            <span className={styles.clock}>{clock}</span>
          </div>

          <div className={styles.statusGroup}>
            <span
              className={styles.statusDot}
              data-ok={apiUp === true}
              title={
                apiUp === true
                  ? "API disponible"
                  : apiUp === false
                    ? "API caida"
                    : "comprobando..."
              }
            >
              API {apiUp === true ? "ON" : apiUp === false ? "OFF" : "…"}
            </span>
            <span className={styles.statusDot} data-ok={true}>copilot</span>
          </div>
        </div>
      </header>



      <section className={styles.mainTruck}>
        {/* LEFT: Comandas */}
        <div className={styles.driverLeft}>
          <DeliveryQueue
            routePlan={hybrid.routePlan}
            inputData={hybrid.inputData}
            loadPlan={hybrid.loadPlan}
            currentStopId={currentStopId}
            deliveredStopIds={deliveredStopIds}
            onSelectStop={(stopId) => {
              setCurrentStopId(stopId);
              if (truckViewMode === "general") setTruckViewMode("next-stop");
            }}
            onConfirmDelivery={handleConfirmDelivery}
          />
        </div>

        {/* RIGHT: Truck 3D (biggest area) with Floating Copilot */}
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
          <CopilotChat
            currentStopId={currentStopId}
            routePlan={hybrid.routePlan}
            loadPlan={hybrid.loadPlan}
            inputData={hybrid.inputData}
            onAction={handleCopilotAction}
          />
        </div>
      </section>
    </div>
  );
}

function formatClock(): string {
  const now = new Date();
  return now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default Dashboard;
