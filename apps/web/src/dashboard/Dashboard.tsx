/**
 * Dashboard — flujo real del conductor Damm.
 *
 * FASE "loading":  pantalla completa instrucciones de carga en almacén.
 *                  El conductor confirma slot por slot antes de salir.
 * FASE "driving":  mapa Mapbox con camión animado hacia zona P.
 * FASE "parked":   DeliveryView (3D + artículos + confirm descarga).
 *
 * Rol "warehouse": layout original con paneles (almacenero).
 * Rol "supervisor": SupervisorView con historial real de rutas.
 */
import { useEffect, useMemo, useState } from "react";
import type { CopilotResponse } from "@damm/copilot";
import { RoutePanel }        from "./RoutePanel";
import { CopilotChat }       from "./CopilotChat";
import { WarningsPanel }     from "./WarningsPanel";
import { StrategyComparator} from "./StrategyComparator";
import { TruckStage }        from "./truck3d/TruckStage";
import { DeliveryQueue }     from "./truck3d/DeliveryQueue";
import { RouteMap }          from "./RouteMap";
import { DeliveryView }      from "./DeliveryView";
import { LoadingPhaseView }  from "./LoadingPhaseView";
import { SupervisorView }    from "./SupervisorView";
import type { ViewMode }     from "./truck3d/TruckView3D";
import { buildHybrid, buildTraditional } from "../lib/pipeline";
import { checkApiHealth }    from "../lib/copilotClient";
import { parkingCoord, type LngLat } from "./parkingZones";
import styles from "./Dashboard.module.css";

type Mode        = "driver" | "warehouse" | "supervisor";
type DriverPhase = "loading" | "driving" | "parked";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "driver",     label: "Conductor"  },
  { id: "warehouse",  label: "Almacén"    },
  { id: "supervisor", label: "Supervisor" },
];

const R = "#E32819";
const G = "#F5C842";

export function Dashboard() {
  const hybrid      = useMemo(() => buildHybrid(), []);
  const traditional = useMemo(() => buildTraditional(), []);

  const firstStop = useMemo(
    () => [...hybrid.routePlan.stops].sort((a, b) => a.sequence - b.sequence)[0],
    [hybrid],
  );

  const [mode,             setMode]            = useState<Mode>("driver");
  const [apiUp,            setApiUp]           = useState<boolean | null>(null);
  const [currentStopId,    setCurrentStopId]   = useState(firstStop?.stopId ?? "");
  const [deliveredStopIds, setDeliveredStopIds]= useState<Set<string>>(() => new Set());
  const [selectedSlotId,   setSelectedSlotId]  = useState<string | null>(null);
  const [truckViewMode,    setTruckViewMode]   = useState<ViewMode>("general");
  const [driverPhase,      setDriverPhase]     = useState<DriverPhase>("loading");
  const [truckCoord,       setTruckCoord]      = useState<LngLat | undefined>(undefined);

  useEffect(() => {
    void checkApiHealth().then(setApiUp);
    const id = setInterval(() => void checkApiHealth().then(setApiUp), 12000);
    return () => clearInterval(id);
  }, []);

  function handleCopilotAction(action: CopilotResponse["actions"][number]) {
    if (action.type === "highlight_stop")       setCurrentStopId(action.stopId);
    if (action.type === "highlight_truck_slot") setSelectedSlotId(action.slotId);
  }

  function handleArrived() {
    setDriverPhase("parked");
    setTruckViewMode("next-stop");
  }

  function handleConfirmDelivery(stopId: string) {
    const stop = hybrid.inputData.stops.find(s => s.id === stopId);
    if (stop?.lat && stop?.lng) {
      setTruckCoord(parkingCoord(stopId, stop.lat, stop.lng));
    }
    const updated = new Set(deliveredStopIds);
    updated.add(stopId);
    setDeliveredStopIds(updated);

    const sorted = [...hybrid.routePlan.stops].sort((a, b) => a.sequence - b.sequence);
    const next   = sorted.find(s => !updated.has(s.stopId));
    if (next) setCurrentStopId(next.stopId);

    setTimeout(() => setDriverPhase("driving"), 300);
  }

  /* ── Supervisor — pantalla completa ─────────────────────────────────── */
  if (mode === "supervisor") {
    return <SupervisorView onBack={() => setMode("driver")} />;
  }

  /* ── Conductor — pantalla completa ──────────────────────────────────── */
  if (mode === "driver") {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#0d1117", overflow: "hidden" }}>

        {/* Cabecera */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: 52, flexShrink: 0,
          background: "linear-gradient(90deg,#0D0000 0%,#1a0000 60%,#0D0000 100%)",
          borderBottom: "1px solid rgba(227,40,25,.25)",
          boxShadow: "0 2px 16px rgba(0,0,0,.6)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: R, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px rgba(227,40,25,.6)` }}>
              <svg width="22" height="22" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={G}/></svg>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: -.2 }}>Damm Smart Truck Copilot</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>
                DR0027 · {hybrid.inputData.driver?.name} · {deliveredStopIds.size}/{hybrid.routePlan.stops.length} entregadas
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Badge de fase */}
            {driverPhase === "loading" && (
              <div style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(245,200,66,.4)", background: "rgba(245,200,66,.1)", color: G, fontSize: 11, fontWeight: 700 }}>
                📦 Cargando camión
              </div>
            )}
            {driverPhase === "driving" && (
              <div style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(59,130,246,.5)", background: "rgba(59,130,246,.1)", color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>
                🚛 En ruta
              </div>
            )}
            {driverPhase === "parked" && (
              <div style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(16,185,129,.5)", background: "rgba(16,185,129,.1)", color: "#10b981", fontSize: 11, fontWeight: 700 }}>
                🅿 Descargando
              </div>
            )}

            {/* Switch de rol */}
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                padding: "5px 14px", borderRadius: 8,
                border: `1px solid ${mode === m.id ? R : "rgba(255,255,255,.1)"}`,
                background: mode === m.id ? R : "transparent",
                color: mode === m.id ? "#fff" : "rgba(255,255,255,.5)",
                fontSize: 12, cursor: "pointer", fontWeight: 700, letterSpacing: .3,
              }}>{m.label}</button>
            ))}
          </div>
        </header>

        {/* Pantalla completa por fase */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {driverPhase === "loading" && (
            <LoadingPhaseView
              inputData={hybrid.inputData}
              routePlan={hybrid.routePlan}
              loadPlan={hybrid.loadPlan}
              onStart={() => setDriverPhase("driving")}
            />
          )}
          {driverPhase === "driving" && (
            <RouteMap
              routePlan={hybrid.routePlan}
              inputData={hybrid.inputData}
              currentStopId={currentStopId}
              deliveredStopIds={deliveredStopIds}
              startCoord={truckCoord}
              onArrived={handleArrived}
              onSelectStop={setCurrentStopId}
            />
          )}
          {driverPhase === "parked" && (
            <DeliveryView
              routePlan={hybrid.routePlan}
              inputData={hybrid.inputData}
              loadPlan={hybrid.loadPlan}
              currentStopId={currentStopId}
              deliveredStopIds={deliveredStopIds}
              onConfirm={handleConfirmDelivery}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── Almacén — layout con paneles ───────────────────────────────────── */
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>D</span>
          <div className={styles.brandText}>
            <h1>Damm Smart Truck Copilot</h1>
            <p>
              Reparto DR0027 · {hybrid.inputData.driver?.name ?? "(sin conductor)"} ·
              vehículo {hybrid.inputData.vehicle.id} ·{" "}
              {deliveredStopIds.size}/{hybrid.routePlan.stops.length} entregadas
            </p>
          </div>
        </div>
        <div className={styles.modes} role="tablist">
          {MODES.map(m => (
            <button key={m.id} type="button" role="tab" className={styles.modeBtn}
              data-active={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className={styles.statusGroup}>
          <span className={styles.statusDot} data-ok={apiUp === true}
            title={apiUp === true ? "API en :3001" : apiUp === false ? "API caida" : "comprobando..."}>
            API {apiUp === true ? "ON" : apiUp === false ? "OFF" : "…"}
          </span>
          <span className={styles.statusDot} data-ok={true}>optimizer-route</span>
          <span className={styles.statusDot} data-ok={true}>optimizer-load</span>
          <span className={styles.statusDot} data-ok={true}>copilot</span>
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
            onSelectStop={stopId => {
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
        <StrategyComparator hybrid={hybrid.loadPlan} traditional={traditional.loadPlan} />
      </section>
    </div>
  );
}

function filterByMode(mode: Mode, warnings: ReturnType<typeof buildHybrid>["loadPlan"]["warnings"]) {
  if (mode === "warehouse") return warnings.filter(w => ["heavy_item","stacking","missing_data","capacity"].includes(w.type));
  if (mode === "driver")    return warnings.filter(w => ["access","returnables","capacity"].includes(w.type));
  return warnings;
}

export default Dashboard;
