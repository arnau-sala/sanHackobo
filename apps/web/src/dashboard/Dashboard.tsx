/**
 * Dashboard — Damm Smart Truck Copilot
 *
 * CONDUCTOR (3 fases):
 *   "truck"    → Comandas (izq.) + Camión 3D (der.) + botón "Iniciar ruta"
 *   "map"      → Mapa navegación pantalla completa + card próxima parada
 *   "delivery" → Comandas enfocadas (izq.) + Camión filtrado (der.) + Confirmar entrega
 *
 * ALMACÉN (2 fases):
 *   "loading"   → Instrucciones de carga slot por slot (LoadingPhaseView)
 *   "inventory" → Camión 3D + estado inventario en ruta
 *
 * SUPERVISOR → Centro de control histórico (SupervisorView)
 *
 * Diseño: tablet landscape, sin scroll, driver-first.
 * Base visual: rama TONI (CSS tokens, header, barra progreso, reloj).
 */
import { useEffect, useMemo, useState } from "react";
import type { CopilotResponse } from "@damm/copilot";
import { TruckStage }       from "./truck3d/TruckStage";
import { DeliveryQueue }    from "./truck3d/DeliveryQueue";
import { RouteMap }         from "./RouteMap";
import { LoadingPhaseView } from "./LoadingPhaseView";
import { SupervisorView }   from "./SupervisorView";
import { CopilotChat }      from "./CopilotChat";
import type { ViewMode }    from "./truck3d/TruckView3D";
import { buildHybrid, buildTraditional } from "../lib/pipeline";
import { checkApiHealth }   from "../lib/copilotClient";
import { parkingCoord, type LngLat } from "./parkingZones";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import styles from "./Dashboard.module.css";

type Mode           = "driver" | "warehouse" | "supervisor";
type DriverPhase    = "truck" | "map" | "delivery";
type WarehousePhase = "loading" | "inventory";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "driver",     label: "Conductor"  },
  { id: "warehouse",  label: "Almacén"    },
  { id: "supervisor", label: "Supervisor" },
];

// ─── Clock hook ───────────────────────────────────────────────────────────────
function useClock() {
  const fmt = () => new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const [clock, setClock] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setClock(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

// ─── Almacén: inventory view ──────────────────────────────────────────────────
function WarehouseInventoryView({
  routePlan, inputData, loadPlan,
  deliveredStopIds, currentStopId,
  selectedSlotId, truckViewMode,
  onSelectSlot, onChangeMode, onSelectStop,
}: {
  routePlan: RoutePlan; inputData: InputData; loadPlan: LoadPlan;
  deliveredStopIds: Set<string>; currentStopId: string;
  selectedSlotId: string|null; truckViewMode: ViewMode;
  onSelectSlot: (id: string|null) => void;
  onChangeMode: (m: ViewMode) => void;
  onSelectStop: (id: string) => void;
}) {
  const stops       = [...routePlan.stops].sort((a,b) => a.sequence - b.sequence);
  const totalSlots  = loadPlan.palletSlots.length;
  const remaining   = loadPlan.palletSlots.filter(s => {
    const sid = s.items?.[0]?.stopId;
    return sid ? !deliveredStopIds.has(sid) : true;
  });
  const returnables = [...deliveredStopIds].reduce((n, sid) =>
    n + inputData.orders
      .filter(o => o.stopId === sid)
      .reduce((s,o) => s + o.items.filter(i => i.returnable).reduce((ss,i) => ss+i.quantity, 0), 0)
  , 0);
  const emptySlots  = Math.max(0, totalSlots - remaining.length);
  const done = deliveredStopIds.size;
  const total = stops.length;

  return (
    <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <TruckStage
          loadPlan={loadPlan} currentStopId={currentStopId}
          deliveredStopIds={deliveredStopIds} selectedSlotId={selectedSlotId}
          viewMode={truckViewMode} onSelectSlot={onSelectSlot} onChangeMode={onChangeMode}
        />
      </div>
      <div style={{
        width:270, flexShrink:0, background:"var(--bg3, #171b22)",
        borderLeft:"1px solid var(--border, #2a313d)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"inherit",
      }}>
        <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--border, #2a313d)", flexShrink:0 }}>
          <div style={{ color:"var(--t3,#6b7280)", fontSize:9, fontWeight:800, letterSpacing:.7, textTransform:"uppercase", marginBottom:8 }}>
            Estado del camión
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {[
              { l:"Entregadas",    v:`${done}/${total}`,                        c:"#22c55e", i:"✅" },
              { l:"Palets carga",  v:`${remaining.length}/${totalSlots}`,        c:"#e8ebf0", i:"📦" },
              { l:"Retornables",   v:returnables,                               c:"#14b8a6", i:"♻"  },
              { l:"Huecos libres", v:emptySlots, c:emptySlots>2?"#22c55e":"#f59e0b",         i:"🔲" },
            ].map(k => (
              <div key={k.l} style={{ background:"var(--bg4,#1f242d)", borderRadius:8, padding:"8px 9px", border:"1px solid var(--border,#2a313d)" }}>
                <div style={{ color:"var(--t3,#6b7280)", fontSize:8, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>{k.i} {k.l}</div>
                <div style={{ color:k.c, fontWeight:900, fontSize:18, lineHeight:1, marginTop:3, fontVariantNumeric:"tabular-nums" }}>{k.v}</div>
              </div>
            ))}
          </div>
          {returnables > 0 && (
            <div style={{ marginTop:8, padding:"7px 9px", borderRadius:8, background:"rgba(20,184,166,.08)", border:"1px solid rgba(20,184,166,.2)" }}>
              <div style={{ color:"#14b8a6", fontSize:10, fontWeight:700 }}>♻ {returnables} retornables cargados</div>
              <div style={{ color:"var(--t3,#6b7280)", fontSize:9, marginTop:2 }}>{emptySlots>0?`${emptySlots} huecos disponibles`:"Camión completo"}</div>
            </div>
          )}
        </div>
        <div style={{ padding:"8px 10px 4px", flexShrink:0 }}>
          <div style={{ color:"var(--t3,#6b7280)", fontSize:9, fontWeight:800, letterSpacing:.7, textTransform:"uppercase" }}>Paradas</div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"0 8px 10px" }}>
          {stops.map((stop, idx) => {
            const isDone = deliveredStopIds.has(stop.stopId);
            const isCur  = stop.stopId === currentStopId && !isDone;
            return (
              <div key={stop.stopId} onClick={() => onSelectStop(stop.stopId)} style={{
                display:"flex", gap:7, marginBottom:3, cursor:"pointer",
                padding:"7px 8px", borderRadius:8,
                background:isCur?"rgba(225,6,0,.1)":isDone?"rgba(34,197,94,.05)":"transparent",
                border:`1px solid ${isCur?"rgba(225,6,0,.3)":isDone?"rgba(34,197,94,.18)":"transparent"}`,
                opacity:isDone&&!isCur?0.5:1,
              }}>
                <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
                  background:isDone?"rgba(34,197,94,.2)":isCur?"#e10600":"var(--bg4,#1f242d)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:isDone?"#22c55e":isCur?"#fff":"var(--t3,#6b7280)", fontSize:8, fontWeight:900 }}>
                  {isDone?"✓":idx+1}
                </div>
                <div style={{ color:isCur?"#e8ebf0":"#a9b0bd", fontWeight:isCur?700:500, fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
                  {stop.clientName}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function Dashboard() {
  const hybrid      = useMemo(() => buildHybrid(), []);
  const _traditional = useMemo(() => buildTraditional(), []);

  const sortedStops = useMemo(
    () => [...hybrid.routePlan.stops].sort((a,b) => a.sequence - b.sequence),
    [hybrid],
  );

  const [mode,             setMode]           = useState<Mode>("driver");
  const [apiUp,            setApiUp]          = useState<boolean|null>(null);
  const [currentStopId,    setCurrentStopId]  = useState(sortedStops[0]?.stopId ?? "");
  const [deliveredStopIds, setDeliveredStopIds] = useState<Set<string>>(() => new Set());
  const [selectedSlotId,   setSelectedSlotId] = useState<string|null>(null);
  const [truckViewMode,    setTruckViewMode]  = useState<ViewMode>("general");
  const [driverPhase,      setDriverPhase]    = useState<DriverPhase>("truck");
  const [warehousePhase,   setWarehousePhase] = useState<WarehousePhase>("loading");
  const [truckCoord,       setTruckCoord]     = useState<LngLat|undefined>(undefined);
  const clock = useClock();

  useEffect(() => {
    void checkApiHealth().then(setApiUp);
    const id = setInterval(() => void checkApiHealth().then(setApiUp), 12000);
    return () => clearInterval(id);
  }, []);

  const totalStops     = hybrid.routePlan.stops.length;
  const deliveredCount = deliveredStopIds.size;
  const progressPct    = totalStops > 0 ? (deliveredCount / totalStops) * 100 : 0;
  const routeDone      = deliveredCount === totalStops && totalStops > 0;

  const currentStop = useMemo(() => {
    const rs     = hybrid.routePlan.stops.find(s => s.stopId === currentStopId);
    const stop   = hybrid.inputData.stops.find(s => s.id === currentStopId);
    const orders = hybrid.inputData.orders.filter(o => o.stopId === currentStopId);
    const total  = orders.reduce((s,o) => s+o.items.reduce((ss,i)=>ss+i.quantity,0), 0);
    return { rs, stop, orders, totalItems: total };
  }, [hybrid, currentStopId]);

  function handleCopilotAction(action: CopilotResponse["actions"][number]) {
    if (action.type === "highlight_stop")       setCurrentStopId(action.stopId);
    if (action.type === "highlight_truck_slot") setSelectedSlotId(action.slotId);
  }

  function handleConfirmDelivery(stopId: string) {
    const stop = hybrid.inputData.stops.find(s => s.id === stopId);
    if (stop?.lat && stop?.lng) setTruckCoord(parkingCoord(stopId, stop.lat, stop.lng));
    const updated = new Set(deliveredStopIds);
    updated.add(stopId);
    setDeliveredStopIds(updated);
    const next = sortedStops.find(s => !updated.has(s.stopId));
    if (next) setCurrentStopId(next.stopId);
    // Volver a ver el camión antes de la siguiente ruta
    setDriverPhase("truck");
    setTruckViewMode("next-stop");
  }

  // ── Supervisor ──────────────────────────────────────────────────────────────
  if (mode === "supervisor") {
    return <SupervisorView onBack={() => setMode("driver")} />;
  }

  // ── Header (compartido) ─────────────────────────────────────────────────────
  const phaseBadgeText =
    mode === "warehouse"
      ? (warehousePhase === "loading" ? "📦 Cargando camión" : "🔄 Control en ruta")
      : driverPhase === "truck"    ? "📦 Ver carga"
      : driverPhase === "map"      ? "🗺 Navegando"
      : "📍 Entregando";

  const phaseBadgeClass =
    driverPhase === "map" ? styles.map
    : driverPhase === "delivery" ? styles.delivery
    : styles.truck;

  const header = (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.brand}>
          <span className={styles.logo}>D</span>
          <div className={styles.brandText}>
            <h1>Damm Smart Truck Copilot</h1>
            <p>{hybrid.inputData.driver?.name ?? "Conductor"} · {hybrid.inputData.vehicle.id}</p>
          </div>
        </div>

        <div className={styles.progressBlock}>
          <div className={styles.progressInfo}>
            <span className={styles.progressLabel}>🚛 {deliveredCount}/{totalStops} entregas</span>
            <span className={styles.progressPct}>{Math.round(progressPct)}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width:`${progressPct}%` }}/>
          </div>
        </div>

        <span className={`${styles.phaseBadge} ${phaseBadgeClass}`}>{phaseBadgeText}</span>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.modes} role="tablist">
          {MODES.map(m => (
            <button key={m.id} type="button" role="tab"
              className={styles.modeBtn} data-active={mode === m.id}
              onClick={() => setMode(m.id)}>{m.label}
            </button>
          ))}
        </div>
        <span className={styles.clock}>{clock}</span>
        <div className={styles.statusGroup}>
          <span className={styles.statusDot} data-ok={apiUp === true}>
            API {apiUp===true?"ON":apiUp===false?"OFF":"…"}
          </span>
          <span className={styles.statusDot} data-ok={true}>copilot</span>
        </div>
      </div>
    </header>
  );

  // ── ALMACÉN ─────────────────────────────────────────────────────────────────
  if (mode === "warehouse") {
    return (
      <div className={styles.shell}>
        {header}
        <div style={{ flex:1, minHeight:0 }}>
          {warehousePhase === "loading" ? (
            <LoadingPhaseView
              inputData={hybrid.inputData}
              routePlan={hybrid.routePlan}
              loadPlan={hybrid.loadPlan}
              onStart={() => setWarehousePhase("inventory")}
            />
          ) : (
            <WarehouseInventoryView
              routePlan={hybrid.routePlan} inputData={hybrid.inputData}
              loadPlan={hybrid.loadPlan} deliveredStopIds={deliveredStopIds}
              currentStopId={currentStopId} selectedSlotId={selectedSlotId}
              truckViewMode={truckViewMode} onSelectSlot={setSelectedSlotId}
              onChangeMode={setTruckViewMode}
              onSelectStop={id => { setCurrentStopId(id); setTruckViewMode("next-stop"); }}
            />
          )}
        </div>
      </div>
    );
  }

  // ── CONDUCTOR · fase MAP ─────────────────────────────────────────────────────
  if (driverPhase === "map") {
    return (
      <div className={styles.shell}>
        {header}
        <div style={{ flex:1, minHeight:0, position:"relative", overflow:"hidden", borderRadius:10, border:"1px solid var(--border,#2a313d)" }}>
          <RouteMap
            routePlan={hybrid.routePlan} inputData={hybrid.inputData}
            currentStopId={currentStopId} deliveredStopIds={deliveredStopIds}
            startCoord={truckCoord}
            onArrived={() => setDriverPhase("delivery")}
            onSelectStop={setCurrentStopId}
          />

          {/* Progreso flotante */}
          <div className={styles.mapProgressFloat}>
            <span className={styles.mapProgressNum}>{deliveredCount}/{totalStops}</span>
            <span className={styles.mapProgressText}>paradas completadas</span>
          </div>

          {/* Card próxima parada */}
          <div className={styles.mapNextStop}>
            <span className={styles.mapNextStopLabel}>📍 Próxima parada</span>
            <div className={styles.mapNextStopName}>
              {currentStop.stop?.clientName ?? currentStop.rs?.clientName ?? "—"}
            </div>
            <div className={styles.mapNextStopMeta}>
              {[
                currentStop.stop?.address ?? currentStop.stop?.zone,
                currentStop.totalItems > 0 ? `${currentStop.totalItems} uds` : null,
                currentStop.rs?.arrivalEta ? `ETA ${currentStop.rs.arrivalEta}` : null,
              ].filter(Boolean).join(" · ")}
            </div>
            <button className={styles.mapArrivedBtn}
              onClick={() => setDriverPhase("delivery")}>
              ✅ He llegado
            </button>
          </div>

          {/* Botón volver */}
          <div style={{ position:"absolute", top:16, right:16, zIndex:10 }}>
            <button onClick={() => setDriverPhase("truck")} style={{
              padding:"7px 14px", borderRadius:9, border:"1px solid rgba(255,255,255,.12)",
              background:"rgba(10,12,16,.85)", backdropFilter:"blur(8px)",
              color:"#a9b0bd", fontSize:11, fontWeight:700, cursor:"pointer",
            }}>← Ver camión</button>
          </div>

          {/* Copiloto */}
          <div className={styles.copilotFloating}>
            <CopilotChat
              currentStopId={currentStopId} routePlan={hybrid.routePlan}
              loadPlan={hybrid.loadPlan} inputData={hybrid.inputData}
              onAction={handleCopilotAction}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── CONDUCTOR · fase TRUCK / DELIVERY ────────────────────────────────────────
  return (
    <div className={styles.shell}>
      {header}

      <section className={styles.mainTruck}>
        {/* ── Izq: Comandas ─────────────────────────────────────────── */}
        <div className={styles.driverLeft}>
          <DeliveryQueue
            routePlan={hybrid.routePlan} inputData={hybrid.inputData}
            loadPlan={hybrid.loadPlan} currentStopId={currentStopId}
            deliveredStopIds={deliveredStopIds} compact
            onSelectStop={stopId => { setCurrentStopId(stopId); setTruckViewMode("next-stop"); }}
            onConfirmDelivery={handleConfirmDelivery}
          />
        </div>

        {/* ── Der: Camión 3D + controles ────────────────────────────── */}
        <div className={styles.truckMain}>
          <TruckStage
            loadPlan={hybrid.loadPlan} currentStopId={currentStopId}
            deliveredStopIds={deliveredStopIds} selectedSlotId={selectedSlotId}
            viewMode={truckViewMode} onSelectSlot={setSelectedSlotId}
            onChangeMode={setTruckViewMode}
          />

          {/* Copiloto flotante */}
          <div className={styles.copilotFloating}>
            <CopilotChat
              currentStopId={currentStopId} routePlan={hybrid.routePlan}
              loadPlan={hybrid.loadPlan} inputData={hybrid.inputData}
              onAction={handleCopilotAction}
            />
          </div>

          {/* Controles de fase */}
          <div style={{
            position:"absolute", bottom:20, right:20, zIndex:20,
            display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end",
          }}>
            {/* Info próxima parada */}
            {!routeDone && (
              <div style={{
                background:"rgba(10,12,16,.92)", backdropFilter:"blur(10px)",
                border:"1px solid var(--border,#2a313d)", borderRadius:12,
                padding:"10px 16px", maxWidth:290,
              }}>
                <div style={{ color:"#e10600", fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:.6, marginBottom:4 }}>
                  {driverPhase === "truck" ? "📍 Siguiente destino" : "📍 Entregando en"}
                </div>
                <div style={{ color:"#e8ebf0", fontWeight:800, fontSize:14, marginBottom:3 }}>
                  {currentStop.stop?.clientName ?? currentStop.rs?.clientName ?? "—"}
                </div>
                <div style={{ color:"#a9b0bd", fontSize:11 }}>
                  {[
                    currentStop.stop?.address ?? currentStop.stop?.zone,
                    currentStop.totalItems > 0 ? `${currentStop.totalItems} uds` : null,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}

            {/* Botón principal */}
            {driverPhase === "truck" && (
              <button
                onClick={() => setDriverPhase("map")}
                disabled={routeDone}
                style={{
                  padding:"13px 28px", borderRadius:12, border:"none",
                  background: routeDone ? "var(--bg4,#1f242d)" : "#e10600",
                  color:"#fff", fontSize:14, fontWeight:800, cursor: routeDone ? "default" : "pointer",
                  boxShadow: routeDone ? "none" : "0 4px 20px rgba(225,6,0,.45)",
                  letterSpacing:.3, transition:"all .15s",
                  opacity: routeDone ? 0.5 : 1,
                }}>
                {routeDone ? "✅ Ruta completada" : "🚛 Iniciar ruta →"}
              </button>
            )}

            {driverPhase === "delivery" && (
              <button onClick={() => setDriverPhase("map")} style={{
                padding:"10px 20px", borderRadius:10,
                border:"1px solid var(--border,#2a313d)",
                background:"rgba(10,12,16,.9)", backdropFilter:"blur(8px)",
                color:"#a9b0bd", fontSize:12, fontWeight:700, cursor:"pointer",
              }}>
                ← Volver al mapa
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
