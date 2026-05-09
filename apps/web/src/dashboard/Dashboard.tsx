/**
 * Damm Smart Truck Copilot - Demo dashboard.
 *
 * Layout:
 *
 *   Header   : marca + modos (conductor/almacen/supervisor) + estado API
 *   Center   : RoutePanel | TruckLoadView (3D pseudo + drawer) | CopilotChat
 *   Footer   : alertas operativas | comparativa antes/despues
 *
 * Es deliberadamente simple, prioriza demostrar que cada modulo del backend
 * funciona y que la UI se integra con todos:
 *
 *   - optimizer-route: el RoutePlan se importa y se renderiza tal cual.
 *   - optimizer-load:  optimizeLoad() en el cliente y, opcionalmente, via
 *                      POST /api/optimize-load (ver lib/copilotClient).
 *   - copilot:         POST /api/copilot (con fallback al motor in-browser).
 *   - elevenlabs:      POST /api/voice/query si la API esta disponible.
 *   - speech api:      input por voz con Web Speech API (Chrome/Edge).
 *
 * Modos de UI:
 *
 *   - "driver"     : panel chat extendido, simulacion de descarga grande.
 *   - "warehouse"  : foco en alertas de carga (apilado, accesibilidad).
 *   - "supervisor" : KPIs + comparativa antes/despues.
 */
import { useEffect, useMemo, useState } from "react";
import type { CopilotResponse } from "@damm/copilot";
import { TruckLoadView } from "../components/truck/TruckLoadView";
import { RoutePanel } from "./RoutePanel";
import { CopilotChat } from "./CopilotChat";
import { WarningsPanel } from "./WarningsPanel";
import { StrategyComparator } from "./StrategyComparator";
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
              vehiculo {hybrid.inputData.vehicle.id}
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

      <section className={styles.main}>
        <RoutePanel
          routePlan={hybrid.routePlan}
          inputData={hybrid.inputData}
          currentStopId={currentStopId}
          onSelectStop={setCurrentStopId}
        />

        <div className={styles.truckPanel}>
          <div className={styles.truckPanelInner}>
            <TruckLoadView
              loadPlan={hybrid.loadPlan}
              highlightedStopId={currentStopId}
              title="Vista de camion"
            />
          </div>
        </div>

        <CopilotChat
          currentStopId={currentStopId}
          routePlan={hybrid.routePlan}
          loadPlan={hybrid.loadPlan}
          inputData={hybrid.inputData}
          onAction={handleCopilotAction}
        />
      </section>

      <section className={styles.footerGrid}>
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
