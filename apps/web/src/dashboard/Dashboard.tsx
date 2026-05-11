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
  const [detailTab,        setDetailTab]      = useState<"palets" | "deliveries">("deliveries");
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
    const pendingStops  = sortedStops.filter(s => !deliveredStopIds.has(s.stopId) && !skippedStopIds.has(s.stopId));
    const firstPending  = pendingStops[0];
    const outOfSequence = !!firstPending && currentStopId !== firstPending.stopId && !deliveredStopIds.has(currentStopId);

    return (
      <div className={styles.shell}>
        {header}
        <div style={{ flex:1, minHeight:0, display:"flex", gap:6, overflow:"hidden" }}>

          {/* ══ Columna izquierda ══════════════════════════════════════════ */}
          <div style={{
            width:300, flexShrink:0,
            display:"flex", flexDirection:"column",
            overflow:"hidden", gap:6,
          }}>

            {/* ── Copilot compacto ─────────────────────────────────────── */}
            <div style={{
              flexShrink:0,
              background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
              border:"1px solid var(--border,#e7e2dd)",
              borderRadius:12,
              boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 6px 16px rgba(17,17,17,.05)",
              overflow:"hidden",
            }}>
              <CopilotChat
                routePlan={hybrid.routePlan} inputData={hybrid.inputData}
                loadPlan={hybrid.loadPlan} currentStopId={currentStopId}
                onAction={() => {}}
              />
            </div>

            {/* ── Destino actual (card hero) ────────────────────────────── */}
            <div style={{
              flexShrink:0, position:"relative", overflow:"hidden",
              background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
              border:"1px solid rgba(225,6,0,.25)",
              borderRadius:14,
              boxShadow:"0 8px 24px rgba(225,6,0,.12), 0 1px 0 rgba(255,255,255,.6) inset",
              padding:"13px 15px 12px 18px",
            }}>
              {/* Barra lateral roja */}
              <span style={{
                position:"absolute", left:0, top:10, bottom:10, width:3,
                background:"linear-gradient(180deg,#e10600,#b00500)", borderRadius:"0 3px 3px 0",
              }}/>
              {/* Hairline dorada */}
              <span style={{
                position:"absolute", left:14, right:14, top:0, height:1,
                background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)",
              }}/>

              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:7 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#e10600", fontSize:9, fontWeight:800, textTransform:"uppercase",
                    letterSpacing:".1em", marginBottom:4, display:"flex", alignItems:"center", gap:5 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      <circle cx="12" cy="9" r="2.5"/>
                    </svg>
                    Destino actual
                  </div>
                  <div style={{ color:"#0f1115", fontWeight:900, fontSize:15, lineHeight:1.2,
                    letterSpacing:"-.02em", marginBottom:4 }}>
                    {currentStop.stop?.clientName ?? currentStop.rs?.clientName ?? "—"}
                  </div>
                  <div style={{ color:"#6b7280", fontSize:10, fontWeight:500 }}>
                    {currentStop.stop?.address ?? currentStop.stop?.zone ?? ""}
                  </div>
                </div>
                {currentStop.rs?.arrivalEta && (
                  <div style={{
                    flexShrink:0, textAlign:"center",
                    background:"rgba(225,6,0,.07)", border:"1px solid rgba(225,6,0,.18)",
                    borderRadius:10, padding:"6px 10px",
                  }}>
                    <div style={{ color:"#e10600", fontSize:16, fontWeight:900,
                      fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
                      {currentStop.rs.arrivalEta}
                    </div>
                    <div style={{ color:"#9ca3af", fontSize:8, fontWeight:700,
                      textTransform:"uppercase", letterSpacing:.5, marginTop:3 }}>ETA</div>
                  </div>
                )}
              </div>

              {/* Items a entregar */}
              {currentStop.orders.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {currentStop.orders.flatMap(o=>o.items).slice(0,4).map((item,ii) => (
                    <div key={ii} style={{
                      display:"flex", alignItems:"center", gap:4,
                      padding:"3px 8px", borderRadius:20,
                      background:"rgba(225,6,0,.06)", border:"1px solid rgba(225,6,0,.14)",
                    }}>
                      <span style={{ color:"#4b5563", fontSize:9, fontWeight:600,
                        maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {item.name}
                      </span>
                      <span style={{ color:"#e10600", fontSize:9, fontWeight:900, flexShrink:0 }}>
                        {item.quantity}
                      </span>
                    </div>
                  ))}
                  {currentStop.totalItems > 4 && (
                    <div style={{ padding:"3px 8px", borderRadius:20,
                      background:"rgba(15,17,21,.05)", border:"1px solid var(--border,#e7e2dd)",
                      color:"#6b7280", fontSize:9, fontWeight:600 }}>
                      +{currentStop.totalItems - 4} más
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Progress + lista de paradas ──────────────────────────── */}
            <div style={{
              flex:1, minHeight:0, display:"flex", flexDirection:"column",
              background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
              border:"1px solid var(--border,#e7e2dd)",
              borderRadius:12, overflow:"hidden",
              boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 6px 16px rgba(17,17,17,.04)",
            }}>
              {/* Progress header */}
              <div style={{
                flexShrink:0, padding:"9px 13px 8px",
                borderBottom:"1px solid var(--border2,#efeae3)",
                display:"flex", alignItems:"center", gap:10,
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ color:"var(--t3,#6b7280)", fontSize:9, fontWeight:700,
                      textTransform:"uppercase", letterSpacing:.5 }}>
                      Ruta del día
                    </span>
                    <span style={{ color:"var(--t1,#0f1115)", fontSize:10, fontWeight:900,
                      fontVariantNumeric:"tabular-nums" }}>
                      {deliveredCount}<span style={{ color:"var(--t3,#6b7280)", fontWeight:400 }}>/{totalStops}</span>
                    </span>
                  </div>
                  <div style={{ height:5, background:"var(--border2,#efeae3)", borderRadius:999, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${progressPct}%`,
                      background:"linear-gradient(90deg,#b00500,#e10600,#ff3a28)",
                      borderRadius:999, transition:"width .6s cubic-bezier(.4,0,.2,1)" }}/>
                  </div>
                </div>
              </div>

              {/* Out-of-sequence warning */}
              {outOfSequence && (
                <div onClick={() => setCurrentStopId(firstPending.stopId)}
                  style={{ flexShrink:0, margin:"6px 8px 0", padding:"6px 10px", borderRadius:8, cursor:"pointer",
                    background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.28)",
                    color:"#b45309", fontSize:9, fontWeight:700 }}>
                  ⚠ Fuera de orden · Ir a {(firstPending.clientName ?? firstPending.stopId).slice(0,20)}
                </div>
              )}

              {/* Lista */}
              <div style={{ flex:1, overflowY:"auto", padding:"6px 8px 8px" }}>
                {sortedStops.map((rs, idx) => {
                  const isDone    = deliveredStopIds.has(rs.stopId);
                  const isSkipped = skippedStopIds.has(rs.stopId);
                  const isCur     = rs.stopId === currentStopId && !isDone && !isSkipped;
                  const inputStop = hybrid.inputData.stops.find(s => s.id === rs.stopId);
                  const orders    = hybrid.inputData.orders.filter(o => o.stopId === rs.stopId);
                  const totalQty  = orders.flatMap(o=>o.items).reduce((s,i) => s+i.quantity, 0);

                  if (isDone) return (
                    <div key={rs.stopId} style={{
                      display:"flex", alignItems:"center", gap:7,
                      padding:"5px 8px", marginBottom:2, borderRadius:7, opacity:0.45,
                    }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                        background:"rgba(22,163,74,.15)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#16a34a", fontSize:9, fontWeight:900 }}>✓</div>
                      <span style={{ color:"var(--t3,#6b7280)", fontSize:10, fontWeight:500,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                        {rs.clientName}
                      </span>
                    </div>
                  );

                  if (isSkipped) return (
                    <div key={rs.stopId} style={{
                      display:"flex", alignItems:"center", gap:7,
                      padding:"5px 8px", marginBottom:2, borderRadius:7, opacity:0.55,
                    }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                        background:"rgba(245,158,11,.15)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#b45309", fontSize:9, fontWeight:900 }}>!</div>
                      <span style={{ color:"#b45309", fontSize:10, fontWeight:500,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                        {rs.clientName}
                      </span>
                    </div>
                  );

                  return (
                    <div key={rs.stopId}
                      onClick={() => { setCurrentStopId(rs.stopId); setExpandedStopId(null); }}
                      style={{
                        display:"flex", alignItems:"center", gap:8,
                        padding:"7px 9px", marginBottom:3, borderRadius:9,
                        cursor:"pointer",
                        background: isCur ? "rgba(225,6,0,.06)" : "transparent",
                        border: `1px solid ${isCur ? "rgba(225,6,0,.2)" : "transparent"}`,
                        transition:"background .12s",
                      }}
                    >
                      <div style={{
                        width:22, height:22, borderRadius:"50%", flexShrink:0,
                        background: isCur ? "#e10600" : "var(--border2,#efeae3)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color: isCur ? "#fff" : "var(--t3,#6b7280)",
                        fontSize:9, fontWeight:900,
                        boxShadow: isCur ? "0 2px 8px rgba(225,6,0,.35)" : "none",
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          color: isCur ? "#0f1115" : "var(--t2,#4b5563)",
                          fontWeight: isCur ? 800 : 500,
                          fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        }}>
                          {rs.clientName}
                        </div>
                        <div style={{ color:"var(--t3,#6b7280)", fontSize:9, marginTop:1 }}>
                          {[inputStop?.address ?? inputStop?.zone,
                            totalQty > 0 ? `${totalQty} uds` : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {rs.arrivalEta && (
                        <div style={{ flexShrink:0, textAlign:"right" }}>
                          <div style={{ color: isCur ? "#e10600" : "var(--t3,#6b7280)",
                            fontSize:10, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                            {rs.arrivalEta}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Botones pie ───────────────────────────────────────────── */}
            <div style={{ flexShrink:0, display:"flex", flexDirection:"column", gap:5 }}>
              <button className={styles.mapArrivedBtn} onClick={() => setDriverPhase("delivery")}>
                ✅ He llegado
              </button>
              <div style={{ display:"flex", gap:6 }}>
                <button
                  onClick={() => reportIncidence(currentStopId)}
                  disabled={!currentStopId || deliveredStopIds.has(currentStopId)}
                  style={{
                    flex:1, padding:"8px 10px", borderRadius:10,
                    border:"1px solid rgba(245,158,11,.35)",
                    background:"rgba(245,158,11,.08)",
                    color:"#b45309", fontSize:10, fontWeight:700, cursor:"pointer",
                  }}>
                  ⚠ Incidencia
                </button>
                <button onClick={() => setDriverPhase("truck")} style={{
                  flex:1, padding:"8px 10px", borderRadius:10,
                  border:"1px solid var(--border,#e7e2dd)",
                  background:"linear-gradient(180deg,#fff,#fbf9f6)",
                  color:"var(--t2,#4b5563)", fontSize:10, fontWeight:700, cursor:"pointer",
                }}>
                  ← Camión
                </button>
              </div>
            </div>
          </div>

          {/* ── Mapa ─────────────────────────────────────────────────── */}
          <div style={{ flex:1, minWidth:0, position:"relative", borderRadius:10, overflow:"hidden",
            border:"1px solid var(--border,#e7e2dd)",
            boxShadow:"0 8px 22px rgba(17,17,17,.05)" }}>
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

          {/* Resumen de jornada */}
          {(() => {
            const rp = hybrid.routePlan as any;
            const km  = rp.estimatedKm   ? Math.round(rp.estimatedKm)   : null;
            const lastStop = sortedStops[sortedStops.length - 1];
            const etaFin   = lastStop?.arrivalEta ?? null;

            const IcoCheck = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
            const IcoRoute = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19h6a4 4 0 0 0 0-8h-5a4 4 0 0 1 0-8h6"/></svg>;
            const IcoFlag  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>;

            const metrics = [
              { ico:IcoCheck, value:`${deliveredCount}/${totalStops}`, label:"paradas" },
              { ico:IcoRoute, value: km ? `${km} km` : "—",            label:"ruta total" },
              { ico:IcoFlag,  value: etaFin ? `~${etaFin}` : "—",      label:"hora fin" },
            ];
            return (
              <div style={{
                flexShrink:0, margin:"0 0 4px",
                display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
                gap:6, padding:"0 1px",
              }}>
                {metrics.map(m => (
                  <div key={m.label} style={{
                    position:"relative",
                    background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                    border:"1px solid var(--border,#e7e2dd)",
                    borderRadius:12, padding:"9px 6px 8px",
                    textAlign:"center",
                    boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 6px 16px rgba(17,17,17,.04)",
                    overflow:"hidden",
                  }}>
                    <div style={{
                      position:"absolute", left:10, right:10, top:0, height:1,
                      background:"linear-gradient(90deg,transparent,rgba(245,200,66,.6),transparent)",
                    }}/>
                    <div style={{ color:"var(--red,#e10600)", display:"flex", justifyContent:"center", marginBottom:4, lineHeight:0 }}>{m.ico}</div>
                    <div style={{ color:"#0f1115", fontWeight:900, fontSize:13, lineHeight:1, fontVariantNumeric:"tabular-nums", letterSpacing:"-.01em" }}>{m.value}</div>
                    <div style={{ color:"var(--t3,#6b7280)", fontSize:8.5, marginTop:4, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase" }}>{m.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Info próxima parada y botones */}
          <div className={styles.driverLeftFooter}>
            {!routeDone && (
              <div style={{
                position:"relative",
                background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                border:`1px solid ${driverPhase === "delivery" ? "rgba(225,6,0,.35)" : "var(--border,#e7e2dd)"}`,
                borderRadius:14,
                padding:"12px 14px 11px 16px",
                boxShadow: driverPhase === "delivery"
                  ? "0 10px 28px rgba(225,6,0,.14), 0 1px 0 rgba(255,255,255,.6) inset"
                  : "0 8px 22px rgba(17,17,17,.06), 0 1px 0 rgba(255,255,255,.6) inset",
                maxHeight: driverPhase === "delivery" ? 220 : "auto",
                display:"flex", flexDirection:"column", overflow:"hidden",
              }}>
                {/* hairline gold + barra lateral roja */}
                <span style={{
                  position:"absolute", left:0, top:10, bottom:10, width:3,
                  background:"linear-gradient(180deg,var(--red,#e10600),var(--red-lo,#b00500))",
                  borderRadius:"0 3px 3px 0",
                }}/>
                <span style={{
                  position:"absolute", left:14, right:14, top:0, height:1,
                  background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)",
                }}/>
                <div style={{
                  display:"flex", alignItems:"center", gap:6,
                  color:"#e10600", fontSize:9.5, fontWeight:800,
                  textTransform:"uppercase", letterSpacing:".1em", marginBottom:5,
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  {driverPhase === "truck" ? "Siguiente destino" : "Entregando en"}
                </div>
                <div style={{
                  color:"#0f1115", fontWeight:800, fontSize:14, marginBottom:3,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  letterSpacing:"-.01em",
                }}>
                  {currentStop.stop?.clientName ?? currentStop.rs?.clientName ?? "—"}
                </div>
                <div style={{ color:"#6b7280", fontSize:10.5, fontWeight:500, marginBottom: driverPhase === "delivery" ? 6 : 0 }}>
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
              <>
                <button
                  onClick={() => setDriverPhase("map")}
                  disabled={routeDone}
                  style={{
                    position:"relative",
                    padding:"15px 28px", borderRadius:13, border:"none",
                    background: routeDone
                      ? "linear-gradient(180deg,#f3f4f6,#e9eaec)"
                      : "linear-gradient(180deg,#ff3a28 0%,#e10600 50%,#b00500 100%)",
                    color: routeDone ? "#9ca3af" : "#fff",
                    fontSize:14, fontWeight:900,
                    cursor: routeDone ? "default" : "pointer",
                    boxShadow: routeDone ? "none"
                      : "0 0 0 1px rgba(245,200,66,.4), 0 10px 24px rgba(225,6,0,.4), inset 0 1px 0 rgba(255,255,255,.32), inset 0 -2px 5px rgba(122,5,0,.5)",
                    letterSpacing:".04em", textTransform:"uppercase",
                    textShadow: routeDone ? "none" : "0 1px 1px rgba(0,0,0,.22)",
                    transition:"transform .12s ease, box-shadow .2s ease",
                    overflow:"hidden",
                  }}
                  onMouseDown={e => { if (!routeDone) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px) scale(.99)"; }}
                  onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)"; }}
                >
                  {routeDone ? "Ruta completada" : routeStarted ? "Continuar ruta →" : "Iniciar ruta →"}
                </button>

                {/* ── Briefing de jornada ── */}
                {!routeDone && (() => {
                  const rp = hybrid.routePlan as any;
                  const ip = hybrid.inputData;
                  const lp = hybrid.loadPlan;

                  const totalUnits   = ip.orders.reduce((s:number,o:any)=>s+o.items.reduce((ss:number,i:any)=>ss+i.quantity,0),0);
                  const totalBarrels = ip.orders.reduce((s:number,o:any)=>s+o.items.filter((i:any)=>i.unit==="Barril"||/barril|keg/i.test(i.name)).reduce((ss:number,i:any)=>ss+i.quantity,0),0);
                  const totalRet     = ip.orders.reduce((s:number,o:any)=>s+o.items.filter((i:any)=>i.returnable).reduce((ss:number,i:any)=>ss+i.quantity,0),0);
                  const usedSlots    = lp.palletSlots.filter((s:any)=>s.items?.length>0).length;
                  const totalSlots   = lp.palletSlots.length;
                  const contadoOrders= ip.orders.filter((o:any)=>o.paymentType==="CONTADO"||o.collectionAmount>0);
                  const cashTotal    = contadoOrders.reduce((s:number,o:any)=>s+(o.collectionAmount??0),0);
                  const mins         = rp.estimatedMinutes??0;
                  const durStr       = mins>0?(Math.floor(mins/60)>0?`${Math.floor(mins/60)}h ${mins%60}min`:`${mins%60} min`):"—";
                  const zones        = [...new Set(ip.stops.map((s:any)=>s.zone??s.route).filter(Boolean))];

                  // SVG icons — Heroicons outline 16px
                  const IcoPallet  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="14" width="20" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="8" y="6"  width="8"  height="4" rx="1"/></svg>;
                  const IcoBeer    = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12l-1 7H7L6 2z"/><rect x="5" y="9" width="14" height="13" rx="2"/><line x1="9" y1="13" x2="9" y2="18"/><line x1="12" y1="13" x2="12" y2="18"/><line x1="15" y1="13" x2="15" y2="18"/></svg>;
                  const IcoReturn  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>;
                  const IcoCash    = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
                  const IcoClock   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
                  const IcoPin     = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
                  const IcoBox     = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;

                  const grid = [
                    { ico:IcoPallet, label:"Palets",     value:`${usedSlots}/${totalSlots}`,                        color:"#e10600" },
                    { ico:IcoBox,    label:"Unidades",   value:`${totalUnits}`,                                     color:"#111827" },
                    { ico:IcoBeer,   label:"Barriles",   value: totalBarrels>0?`${totalBarrels}`:"0",               color:"#e10600" },
                    { ico:IcoReturn, label:"Retornables",value: totalRet>0?`${totalRet} ud`:"Ninguno",              color: totalRet>0?"#b45309":"#6b7280" },
                    { ico:IcoCash,   label:"Efectivo",   value: cashTotal>0?`${cashTotal.toLocaleString("es-ES")} €`:`${contadoOrders.length} cl.`, color:"#16a34a" },
                    { ico:IcoClock,  label:"Duración",   value: durStr,                                             color:"#111827" },
                  ];

                  return (
                    <div style={{
                      position:"relative",
                      background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                      border:"1px solid var(--border,#e7e2dd)",
                      borderRadius:14, overflow:"hidden",
                      boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)",
                    }}>
                      {/* Hairline gold top */}
                      <span style={{
                        position:"absolute", left:14, right:14, top:0, height:1,
                        background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)",
                      }}/>

                      {/* Header */}
                      <div style={{
                        padding:"10px 14px 9px",
                        borderBottom:"1px solid var(--border,#e7e2dd)",
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        background:"linear-gradient(180deg,rgba(225,6,0,.025),transparent)",
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          {/* Estrella Damm mini */}
                          <svg width="11" height="11" viewBox="-7 -7 14 14">
                            <polygon points="0,-7 1.6,-2.2 6.7,-2.2 2.7,0.8 4.1,5.7 0,2.9 -4.1,5.7 -2.7,0.8 -6.7,-2.2 -1.6,-2.2"
                                    fill="#f5c842" stroke="#c9a020" strokeWidth=".4"/>
                          </svg>
                          <span style={{ color:"#0f1115", fontSize:10, fontWeight:800, letterSpacing:".09em", textTransform:"uppercase" }}>
                            Resumen de jornada
                          </span>
                        </div>
                        <span style={{
                          background:"linear-gradient(180deg,rgba(225,6,0,.1),rgba(225,6,0,.05))",
                          color:"#e10600",
                          fontSize:9, fontWeight:800, borderRadius:999, padding:"3px 9px",
                          border:"1px solid rgba(225,6,0,.22)",
                          letterSpacing:".05em", textTransform:"uppercase",
                          boxShadow:"inset 0 1px 0 rgba(255,255,255,.5)",
                        }}>
                          {zones[0] ?? "Ruta del día"}
                        </span>
                      </div>

                      {/* Grid 2×3 con separadores hairline */}
                      <div style={{
                        display:"grid", gridTemplateColumns:"1fr 1fr",
                        backgroundImage:"linear-gradient(var(--border2,#efeae3),var(--border2,#efeae3)),linear-gradient(var(--border2,#efeae3),var(--border2,#efeae3))",
                        backgroundSize:"1px 100%, 100% 1px",
                        backgroundPosition:"50% 0, 0 33.33%, 0 66.66%",
                        backgroundRepeat:"no-repeat, repeat-y",
                      }}>
                        {grid.map(cell => (
                          <div key={cell.label} style={{
                            padding:"11px 14px 10px",
                            display:"flex", flexDirection:"column", gap:6,
                            position:"relative",
                          }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                              <span style={{
                                color:"var(--red,#e10600)", lineHeight:0,
                                background:"rgba(225,6,0,.07)",
                                width:22, height:22, borderRadius:6,
                                display:"flex", alignItems:"center", justifyContent:"center",
                                border:"1px solid rgba(225,6,0,.12)",
                              }}>{cell.ico}</span>
                              <span style={{ color:"var(--t3,#6b7280)", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em" }}>{cell.label}</span>
                            </div>
                            <span style={{
                              color: cell.color,
                              fontSize:16, fontWeight:900,
                              fontVariantNumeric:"tabular-nums",
                              lineHeight:1, letterSpacing:"-.015em",
                              paddingLeft:1,
                            }}>{cell.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer: zona y pin */}
                      {zones.length > 0 && (
                        <div style={{
                          padding:"9px 14px",
                          borderTop:"1px solid var(--border2,#efeae3)",
                          background:"linear-gradient(180deg,transparent,rgba(245,200,66,.04))",
                          display:"flex", alignItems:"center", gap:8,
                        }}>
                          <span style={{ color:"var(--red,#e10600)", lineHeight:0 }}>{IcoPin}</span>
                          <span style={{ color:"var(--t2,#4b5563)", fontSize:10, fontWeight:700, letterSpacing:".02em" }}>
                            {zones.join(" · ")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
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
