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
          loadPlan={loadPlan} routePlan={routePlan} inputData={inputData}
          currentStopId={currentStopId} deliveredStopIds={deliveredStopIds}
          selectedSlotId={selectedSlotId} viewMode={truckViewMode}
          onSelectSlot={onSelectSlot} onChangeMode={onChangeMode}
        />
      </div>
      <div style={{
        width:270, flexShrink:0, background:"rgba(255,255,255,.96)",
        borderLeft:"1px solid var(--border, #e5e7eb)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"inherit",
      }}>
        <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--border, #e5e7eb)", flexShrink:0 }}>
          <div style={{ color:"var(--t3,#6b7280)", fontSize:9, fontWeight:800, letterSpacing:.7, textTransform:"uppercase", marginBottom:8 }}>
            Estado del camión
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {[
              { l:"Entregadas",    v:`${done}/${total}`,                        c:"#16a34a", i:"✅" },
              { l:"Palets carga",  v:`${remaining.length}/${totalSlots}`,        c:"#111827", i:"📦" },
              { l:"Retornables",   v:returnables,                               c:"#e10600", i:"♻"  },
              { l:"Huecos libres", v:emptySlots, c:emptySlots>2?"#16a34a":"#e10600",         i:"🔲" },
            ].map(k => (
              <div key={k.l} style={{ background:"#fff", borderRadius:8, padding:"8px 9px", border:"1px solid var(--border,#e5e7eb)", boxShadow:"0 6px 16px rgba(17,24,39,.04)" }}>
                <div style={{ color:"var(--t3,#6b7280)", fontSize:8, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>{k.i} {k.l}</div>
                <div style={{ color:k.c, fontWeight:900, fontSize:18, lineHeight:1, marginTop:3, fontVariantNumeric:"tabular-nums" }}>{k.v}</div>
              </div>
            ))}
          </div>
          {returnables > 0 && (
            <div style={{ marginTop:8, padding:"7px 9px", borderRadius:8, background:"rgba(225,6,0,.06)", border:"1px solid rgba(225,6,0,.15)" }}>
              <div style={{ color:"#e10600", fontSize:10, fontWeight:700 }}>♻ {returnables} retornables cargados</div>
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
                background:isCur?"rgba(225,6,0,.08)":isDone?"rgba(225,6,0,.04)":"transparent",
                border:`1px solid ${isCur?"rgba(225,6,0,.22)":isDone?"rgba(225,6,0,.1)":"transparent"}`,
                opacity:isDone&&!isCur?0.5:1,
              }}>
                <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
                  background:isDone?"rgba(225,6,0,.14)":isCur?"#e10600":"#f3f4f6",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:isDone?"#e10600":isCur?"#fff":"var(--t3,#6b7280)", fontSize:8, fontWeight:900 }}>
                  {isDone?"✓":idx+1}
                </div>
                <div style={{ color:isCur?"#111827":"#4b5563", fontWeight:isCur?700:500, fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
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
  // Inicializa la posición del camión en el depot (Mollet).
  // Así la primera ruta sale de la fábrica → primer cliente.
  const [truckCoord,       setTruckCoord]     = useState<LngLat|undefined>(() => {
    const d = hybrid.inputData.depot;
    return d?.lat && d?.lng ? [d.lng, d.lat] : undefined;
  });
  const [detailTab,        setDetailTab]      = useState<"palets" | "deliveries">("palets");
  const [detailItem,       setDetailItem]     = useState<string|null>(null);
  const [expandedStopId,   setExpandedStopId] = useState<string|null>(null);
  const [skippedStopIds,   setSkippedStopIds] = useState<Set<string>>(() => new Set());
  const clock = useClock();

  function reportIncidence(stopId: string) {
    const stop = hybrid.inputData.stops.find(s => s.id === stopId);
    const reason = window.prompt(`Incidencia en ${stop?.clientName ?? "parada"}:\n\n1) Cliente cerrado\n2) Falta producto\n3) Otro\n\nDescribe brevemente:`);
    if (!reason) return;
    const updated = new Set(skippedStopIds);
    updated.add(stopId);
    setSkippedStopIds(updated);
    const next = sortedStops.find(s => !deliveredStopIds.has(s.stopId) && !updated.has(s.stopId));
    if (next) setCurrentStopId(next.stopId);
  }

  useEffect(() => {
    void checkApiHealth().then(setApiUp);
    const id = setInterval(() => void checkApiHealth().then(setApiUp), 12000);
    return () => clearInterval(id);
  }, []);

  // Sync vista del camión 3D con la fase del conductor:
  //  - delivery → modo "next-stop" (atenúa palets no relevantes, resalta los de la parada actual)
  //  - delivery → tab "Entregas" (lista de paradas en panel derecho)
  //  - truck   → modo general
  useEffect(() => {
    if (driverPhase === "delivery") {
      setTruckViewMode("next-stop");
      setDetailTab("deliveries");
    } else if (driverPhase === "truck") {
      setTruckViewMode("general");
    }
  }, [driverPhase]);

  const totalStops     = hybrid.routePlan.stops.length;
  const deliveredCount = deliveredStopIds.size;
  const skippedCount   = skippedStopIds.size;
  const closedCount    = deliveredCount + skippedCount;
  const progressPct    = totalStops > 0 ? (deliveredCount / totalStops) * 100 : 0;
  const routeDone      = closedCount === totalStops && totalStops > 0;
  const routeStarted   = closedCount > 0;

  // ETA fin de ruta: última parada pendiente con ETA conocida
  const routeEndEta = useMemo(() => {
    const pending = sortedStops.filter(s => !deliveredStopIds.has(s.stopId));
    const last = pending[pending.length - 1] ?? sortedStops[sortedStops.length - 1];
    return last?.arrivalEta ?? null;
  }, [sortedStops, deliveredStopIds]);

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
    setTruckViewMode("next-stop");
    // P0: tras confirmar entrega volvemos AL MAPA (siguiente parada),
    // no a la vista de camión. El conductor solo vuelve al camión
    // explícitamente. Si la ruta acabó, mostramos el camión.
    const allDone = (updated.size + skippedStopIds.size) >= sortedStops.length;
    setDriverPhase(allDone ? "truck" : "map");
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
            <span className={styles.progressPct}>
              {Math.round(progressPct)}%
              {routeEndEta && !routeDone && (
                <span style={{ marginLeft:8, fontWeight:600, color:"var(--t3,#6b7280)", fontSize:10 }}>
                  · fin {routeEndEta}
                </span>
              )}
            </span>
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
        <div style={{ flex:1, minHeight:0, display:"flex", gap:6, overflow:"hidden" }}>

          {/* ── Columna izquierda: orb + paradas ─────────────────────── */}
          <div style={{
            width:272, flexShrink:0,
            background:"var(--bg1,#fff)",
            border:"1px solid var(--border,#e5e7eb)",
            borderRadius:10,
            display:"flex", flexDirection:"column",
            overflow:"hidden",
          }}>
            {/* Orb de voz */}
            <div style={{ flexShrink:0 }}>
              <CopilotChat
                routePlan={hybrid.routePlan} inputData={hybrid.inputData}
                loadPlan={hybrid.loadPlan} currentStopId={currentStopId}
                onAction={handleCopilotAction}
              />
            </div>

            {/* Progreso compacto */}
            <div style={{
              flexShrink:0, padding:"6px 12px",
              borderTop:"1px solid var(--border,#e5e7eb)",
              borderBottom:"1px solid var(--border,#e5e7eb)",
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}>
              <span style={{ color:"var(--t3,#6b7280)", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>
                Paradas
              </span>
              <span style={{ color:"var(--t2,#4b5563)", fontSize:10, fontWeight:800 }}>
                {deliveredCount}/{totalStops}
              </span>
            </div>

            {/* Lista de paradas */}
            <div style={{ flex:1, overflowY:"auto", padding:"6px 8px 10px" }}>
              {(() => {
                // Primera pendiente (no entregada ni saltada) = orden óptimo
                const firstPending = sortedStops.find(s => !deliveredStopIds.has(s.stopId) && !skippedStopIds.has(s.stopId));
                const outOfSequence = !!firstPending && currentStopId !== firstPending.stopId && !deliveredStopIds.has(currentStopId);
                return outOfSequence ? (
                  <div
                    onClick={() => setCurrentStopId(firstPending.stopId)}
                    style={{
                      margin:"0 0 6px", padding:"6px 8px", borderRadius:7, cursor:"pointer",
                      background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.3)",
                      color:"#b45309", fontSize:9, fontWeight:700,
                    }}
                  >
                    ⚠ Fuera del orden óptimo · Toca para volver a {firstPending.clientName.slice(0,18)}
                  </div>
                ) : null;
              })()}
              {sortedStops.map((rs, idx) => {
                const isDone    = deliveredStopIds.has(rs.stopId);
                const isSkipped = skippedStopIds.has(rs.stopId);
                const isCur     = rs.stopId === currentStopId && !isDone && !isSkipped;
                const isExpanded = isCur || expandedStopId === rs.stopId;
                const inputStop = hybrid.inputData.stops.find(s => s.id === rs.stopId);
                const orders    = hybrid.inputData.orders.filter(o => o.stopId === rs.stopId);
                const items     = orders.flatMap(o => o.items);
                const totalQty  = items.reduce((s,i) => s + i.quantity, 0);

                const bg     = isCur ? "rgba(225,6,0,.07)"
                            : isDone ? "rgba(34,197,94,.05)"
                            : isSkipped ? "rgba(245,158,11,.06)"
                            : "transparent";
                const border = isCur ? "rgba(225,6,0,.22)"
                            : isDone ? "rgba(34,197,94,.18)"
                            : isSkipped ? "rgba(245,158,11,.22)"
                            : "transparent";
                const dotBg  = isDone ? "rgba(34,197,94,.2)"
                            : isSkipped ? "rgba(245,158,11,.2)"
                            : isCur ? "#e10600" : "#f3f4f6";
                const dotFg  = isDone ? "#16a34a"
                            : isSkipped ? "#b45309"
                            : isCur ? "#fff" : "var(--t3,#6b7280)";
                const dotIco = isDone ? "✓" : isSkipped ? "!" : String(idx + 1);

                return (
                  <div
                    key={rs.stopId}
                    style={{
                      marginBottom:4, borderRadius:9,
                      padding:"8px 10px",
                      background: bg,
                      border:`1px solid ${border}`,
                      opacity: (isDone || isSkipped) && !isCur ? 0.6 : 1,
                      transition:"background .15s",
                    }}
                  >
                    {/* Cabecera parada (clic = seleccionar / toggle expand si es la actual) */}
                    <div
                      onClick={() => {
                        if (isCur) {
                          setExpandedStopId(expandedStopId === rs.stopId ? "__force_collapsed__" : rs.stopId);
                        } else {
                          setCurrentStopId(rs.stopId);
                          setExpandedStopId(null);
                        }
                      }}
                      style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", marginBottom: isExpanded && items.length > 0 ? 6 : 0 }}
                    >
                      <div style={{
                        width:18, height:18, borderRadius:"50%", flexShrink:0,
                        background: dotBg,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color: dotFg, fontSize:8, fontWeight:900,
                      }}>
                        {dotIco}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          color: isCur ? "#111827" : "var(--t2,#4b5563)",
                          fontWeight: isCur ? 800 : 500,
                          fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        }}>
                          {rs.clientName}
                          {isSkipped && <span style={{ marginLeft:4, color:"#b45309", fontSize:8, fontWeight:700 }}>· incidencia</span>}
                        </div>
                        <div style={{ color:"var(--t3,#6b7280)", fontSize:8.5, marginTop:1 }}>
                          {[inputStop?.address ?? inputStop?.zone, totalQty > 0 ? `${totalQty} uds` : null, rs.arrivalEta ? `ETA ${rs.arrivalEta}` : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {items.length > 0 && (
                        <span style={{ color:"var(--t3,#6b7280)", fontSize:9, flexShrink:0 }}>
                          {isExpanded ? "▾" : "▸"}
                        </span>
                      )}
                    </div>

                    {/* Productos (visibles solo si expandido) */}
                    {isExpanded && items.length > 0 && (
                      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                        {items.map((item, ii) => (
                          <div key={ii} style={{
                            display:"flex", justifyContent:"space-between", alignItems:"center",
                            padding:"3px 6px", borderRadius:5,
                            background:"rgba(225,6,0,.04)",
                            border:"1px solid rgba(225,6,0,.1)",
                          }}>
                            <span style={{ color:"var(--t2,#4b5563)", fontSize:8.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>
                              {item.name}
                            </span>
                            <span style={{ color:"#e10600", fontWeight:800, fontSize:8.5, flexShrink:0, marginLeft:4 }}>
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Botones pie */}
            <div style={{ flexShrink:0, padding:"8px 10px", borderTop:"1px solid var(--border,#e5e7eb)", display:"flex", flexDirection:"column", gap:6 }}>
              <button
                className={styles.mapArrivedBtn}
                onClick={() => setDriverPhase("delivery")}
              >
                ✅ He llegado
              </button>
              <div style={{ display:"flex", gap:6 }}>
                <button
                  onClick={() => reportIncidence(currentStopId)}
                  disabled={!currentStopId || deliveredStopIds.has(currentStopId)}
                  style={{
                    flex:1, padding:"7px 10px", borderRadius:9,
                    border:"1px solid rgba(245,158,11,.35)",
                    background:"rgba(245,158,11,.08)",
                    color:"#b45309", fontSize:10, fontWeight:700, cursor:"pointer",
                  }}>
                  ⚠ Incidencia
                </button>
                <button onClick={() => setDriverPhase("truck")} style={{
                  flex:1, padding:"7px 10px", borderRadius:9,
                  border:"1px solid var(--border,#e5e7eb)",
                  background:"transparent",
                  color:"var(--t2,#4b5563)", fontSize:10, fontWeight:700, cursor:"pointer",
                }}>
                  ← Camión
                </button>
              </div>
            </div>
          </div>

          {/* ── Mapa ─────────────────────────────────────────────────── */}
          <div style={{ flex:1, minWidth:0, position:"relative", borderRadius:10, overflow:"hidden", border:"1px solid var(--border,#2a313d)" }}>
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
            </div>
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
        {/* ── Izq: IA manos libres ──────────────────────────────────── */}
        <div className={styles.driverLeft}>
          <div className={styles.copilotChatWrapper}>
            <CopilotChat
              routePlan={hybrid.routePlan} inputData={hybrid.inputData}
              loadPlan={hybrid.loadPlan} currentStopId={currentStopId}
              onAction={handleCopilotAction}
            />
          </div>
          
          {/* Info próxima parada y botones */}
          <div className={styles.driverLeftFooter}>
            {!routeDone && (
              <div style={{
                background:"rgba(255,255,255,.96)", backdropFilter:"blur(10px)",
                border:`1px solid ${driverPhase === "delivery" ? "rgba(225,6,0,.35)" : "var(--border,#2a313d)"}`,
                borderRadius:12,
                padding:"10px 14px",
                boxShadow: driverPhase === "delivery" ? "0 10px 24px rgba(225,6,0,.12)" : "0 10px 24px rgba(17,24,39,.06)",
                maxHeight: driverPhase === "delivery" ? 220 : "auto",
                display:"flex", flexDirection:"column", overflow:"hidden",
              }}>
                <div style={{ color:"#e10600", fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:.6, marginBottom:4 }}>
                  {driverPhase === "truck" ? "📍 Siguiente destino" : "🅿 Entregando en"}
                </div>
                <div style={{ color:"#111827", fontWeight:800, fontSize:13, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {currentStop.stop?.clientName ?? currentStop.rs?.clientName ?? "—"}
                </div>
                <div style={{ color:"#6b7280", fontSize:10, marginBottom: driverPhase === "delivery" ? 6 : 0 }}>
                  {[
                    currentStop.stop?.address ?? currentStop.stop?.zone,
                    currentStop.totalItems > 0 ? `${currentStop.totalItems} uds` : null,
                  ].filter(Boolean).join(" · ")}
                </div>

                {/* Lista de productos a descargar (solo en delivery) */}
                {driverPhase === "delivery" && currentStop.orders.length > 0 && (
                  <div style={{ flex:1, overflowY:"auto", marginTop:2, paddingRight:2 }}>
                    <div style={{ color:"var(--t3,#6b7280)", fontSize:8, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>
                      📦 A descargar
                    </div>
                    {currentStop.orders.flatMap(o => o.items).map((item, ii) => (
                      <div key={ii} style={{
                        display:"flex", justifyContent:"space-between", alignItems:"center", gap:6,
                        padding:"4px 7px", borderRadius:6, marginBottom:3,
                        background:"rgba(225,6,0,.05)",
                        border:"1px solid rgba(225,6,0,.12)",
                      }}>
                        <span style={{ color:"#111827", fontSize:9.5, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
                          {item.name}
                        </span>
                        <span style={{ color:"#e10600", fontWeight:900, fontSize:10, flexShrink:0 }}>
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {driverPhase === "truck" && (
              <button
                onClick={() => setDriverPhase("map")}
                disabled={routeDone}
                style={{
                  padding:"13px 28px", borderRadius:12, border:"none",
                  background: routeDone ? "#f3f4f6" : "#e10600",
                  color:"#fff", fontSize:14, fontWeight:800, cursor: routeDone ? "default" : "pointer",
                  boxShadow: routeDone ? "none" : "0 4px 20px rgba(225,6,0,.28)",
                  letterSpacing:.3, transition:"all .15s",
                  opacity: routeDone ? 0.5 : 1,
                }}>
                {routeDone ? "✅ Ruta completada" : routeStarted ? "🚛 Continuar ruta →" : "🚛 Iniciar ruta →"}
              </button>
            )}

            {driverPhase === "delivery" && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <button
                  onClick={() => handleConfirmDelivery(currentStopId)}
                  disabled={!currentStopId || deliveredStopIds.has(currentStopId)}
                  style={{
                    padding:"14px 24px", borderRadius:12, border:"none",
                    background: "linear-gradient(135deg,#16a34a 0%,#15803d 100%)",
                    color:"#fff", fontSize:14, fontWeight:900, cursor:"pointer",
                    boxShadow:"0 6px 22px rgba(22,163,74,.32)",
                    letterSpacing:.4, transition:"transform .1s",
                  }}
                  onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(.97)"; }}
                  onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                >
                  ✅ He entregado
                </button>
                <div style={{ display:"flex", gap:6 }}>
                  <button
                    onClick={() => reportIncidence(currentStopId)}
                    disabled={!currentStopId || deliveredStopIds.has(currentStopId)}
                    style={{
                      flex:1, padding:"7px 10px", borderRadius:9,
                      border:"1px solid rgba(245,158,11,.35)",
                      background:"rgba(245,158,11,.08)",
                      color:"#b45309", fontSize:10, fontWeight:700, cursor:"pointer",
                    }}>
                    ⚠ Incidencia
                  </button>
                  <button onClick={() => setDriverPhase("map")} style={{
                    flex:1, padding:"7px 10px", borderRadius:9,
                    border:"1px solid var(--border,#e5e7eb)",
                    background:"transparent",
                    color:"var(--t2,#4b5563)", fontSize:10, fontWeight:700, cursor:"pointer",
                  }}>
                    ← Mapa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Der: Camión 3D + controles ────────────────────────────── */}
        <div className={styles.truckMain}>
          <TruckStage
            loadPlan={hybrid.loadPlan} routePlan={hybrid.routePlan}
            inputData={hybrid.inputData} currentStopId={currentStopId}
            deliveredStopIds={deliveredStopIds} selectedSlotId={selectedSlotId}
            viewMode={truckViewMode} onSelectSlot={setSelectedSlotId}
            onChangeMode={setTruckViewMode}
            detailTab={detailTab} detailItem={detailItem}
            onDetailTabChange={setDetailTab} onDetailItemChange={setDetailItem}
          />


        </div>
      </section>
    </div>
  );
}

export default Dashboard;
