/**
 * Dashboard — flujo Damm Smart Truck Copilot
 *
 * CONDUCTOR:
 *   → Mapa en tiempo real + panel de paradas en orden.
 *   → Botón "Iniciar ruta" arranca la navegación.
 *   → Al llegar: confirmación de entrega.
 *
 * ALMACÉN:
 *   → Primero: instrucciones de carga del camión (LoadingPhaseView).
 *   → Después: vista 3D del camión + inventario en tiempo real.
 *     (qué queda, qué se entregó, retornables recogidos, espacio libre).
 *
 * SUPERVISOR:
 *   → Centro de control con datos históricos reales.
 */
import { useEffect, useMemo, useState } from "react";
import type { CopilotResponse } from "@damm/copilot";
import { TruckStage }        from "./truck3d/TruckStage";
import { DeliveryQueue }     from "./truck3d/DeliveryQueue";
import { RouteMap }          from "./RouteMap";
import { DeliveryView }      from "./DeliveryView";
import { LoadingPhaseView }  from "./LoadingPhaseView";
import { SupervisorView }    from "./SupervisorView";
import { CopilotChat }       from "./CopilotChat";
import type { ViewMode }     from "./truck3d/TruckView3D";
import { buildHybrid, buildTraditional } from "../lib/pipeline";
import { checkApiHealth }    from "../lib/copilotClient";
import { parkingCoord, type LngLat } from "./parkingZones";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";

type Mode           = "driver" | "warehouse" | "supervisor";
type DriverPhase    = "ready" | "driving" | "parked";
type WarehousePhase = "loading" | "inventory";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "driver",     label: "Conductor"  },
  { id: "warehouse",  label: "Almacén"    },
  { id: "supervisor", label: "Supervisor" },
];

const R = "#E32819";
const G = "#F5C842";

// ─── Shared header ────────────────────────────────────────────────────────────
function Header({ mode, setMode, badge, subtitle }: {
  mode: Mode; setMode: (m: Mode) => void;
  badge?: React.ReactNode; subtitle?: string;
}) {
  return (
    <header style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 22px", height:50, flexShrink:0,
      background:"linear-gradient(90deg,#0D0000 0%,#1a0000 60%,#0D0000 100%)",
      borderBottom:"1px solid rgba(227,40,25,.25)",
      boxShadow:"0 2px 16px rgba(0,0,0,.6)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:34,height:34,borderRadius:10,background:R,display:"flex",
          alignItems:"center",justifyContent:"center",boxShadow:`0 0 12px rgba(227,40,25,.6)`,flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 22 22">
            <polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={G}/>
          </svg>
        </div>
        <div>
          <div style={{ color:"#fff",fontWeight:800,fontSize:14,letterSpacing:-.2 }}>
            Damm Smart Truck Copilot
          </div>
          {subtitle && (
            <div style={{ color:"rgba(255,255,255,.4)",fontSize:11 }}>{subtitle}</div>
          )}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {badge}
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding:"5px 14px", borderRadius:8,
            border:`1px solid ${mode===m.id?R:"rgba(255,255,255,.1)"}`,
            background:mode===m.id?R:"transparent",
            color:mode===m.id?"#fff":"rgba(255,255,255,.5)",
            fontSize:12,cursor:"pointer",fontWeight:700,letterSpacing:.3,
          }}>{m.label}</button>
        ))}
      </div>
    </header>
  );
}

// ─── Conductor: stop list panel ───────────────────────────────────────────────
function StopListPanel({ routePlan, inputData, currentStopId, deliveredStopIds,
  phase, onStart, onSelectStop }: {
  routePlan: RoutePlan; inputData: InputData;
  currentStopId: string; deliveredStopIds: Set<string>;
  phase: DriverPhase; onStart: () => void;
  onSelectStop: (id: string) => void;
}) {
  const stops = [...routePlan.stops].sort((a,b) => a.sequence - b.sequence);
  const done  = deliveredStopIds.size;
  const total = stops.length;
  const pct   = total > 0 ? Math.round(done/total*100) : 0;

  return (
    <div style={{ width:300, flexShrink:0, background:"#0B1020",
      borderLeft:"1px solid rgba(255,255,255,.07)",
      display:"flex", flexDirection:"column", overflow:"hidden",
      fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid rgba(255,255,255,.07)", flexShrink:0 }}>
        <div style={{ color:"rgba(238,242,255,.4)",fontSize:9,fontWeight:700,
          letterSpacing:.8,textTransform:"uppercase",marginBottom:6 }}>
          Ruta del día
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
          <span style={{ color:"#eef2ff",fontWeight:900,fontSize:20 }}>{done}/{total}</span>
          <span style={{ color:"rgba(238,242,255,.45)",fontSize:11 }}>paradas</span>
        </div>
        {/* Progress bar */}
        <div style={{ height:5,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${pct}%`,background:pct===100?G:R,
            borderRadius:3,transition:"width .5s ease" }}/>
        </div>
        <div style={{ color:"rgba(238,242,255,.35)",fontSize:9,marginTop:4 }}>{pct}% completado</div>

        {/* Iniciar ruta / estado */}
        {phase === "ready" ? (
          <button onClick={onStart} style={{
            width:"100%",marginTop:12,padding:"10px",borderRadius:10,
            background:R,border:"none",color:"#fff",fontWeight:800,fontSize:13,
            cursor:"pointer",boxShadow:`0 4px 20px rgba(227,40,25,.4)`,
            letterSpacing:.3,
          }}>🚛 Iniciar ruta</button>
        ) : (
          <div style={{ marginTop:10,display:"flex",gap:6 }}>
            <div style={{ flex:1,padding:"7px 10px",borderRadius:8,
              background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.25)",
              color:"#60a5fa",fontSize:10,fontWeight:700,textAlign:"center" }}>
              🚛 En ruta
            </div>
          </div>
        )}
      </div>

      {/* Stops list */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 10px 12px" }}>
        {stops.map((stop, idx) => {
          const isDone    = deliveredStopIds.has(stop.stopId);
          const isCurrent = stop.stopId === currentStopId && !isDone;
          const inputStop = inputData.stops.find(s => s.id === stop.stopId);
          const order     = inputStop ? inputData.orders.filter(o => o.stopId === stop.stopId) : [];
          const totalItems= order.reduce((s,o) => s+o.items.reduce((ss,i)=>ss+i.quantity,0), 0);

          return (
            <div key={stop.stopId}
              onClick={() => onSelectStop(stop.stopId)}
              style={{
                display:"flex",gap:8,marginBottom:4,cursor:"pointer",
                padding:"9px 10px",borderRadius:10,
                background:isCurrent?"rgba(227,40,25,.12)":isDone?"rgba(34,197,94,.06)":"rgba(255,255,255,.02)",
                border:`1px solid ${isCurrent?"rgba(227,40,25,.35)":isDone?"rgba(34,197,94,.2)":"rgba(255,255,255,.05)"}`,
                transition:"all .15s",
                opacity: isDone && !isCurrent ? 0.6 : 1,
              }}>

              {/* Sequence number */}
              <div style={{
                width:24,height:24,borderRadius:"50%",flexShrink:0,
                background:isDone?"rgba(34,197,94,.2)":isCurrent?R:"rgba(255,255,255,.06)",
                border:`1.5px solid ${isDone?"#22c55e":isCurrent?R:"rgba(255,255,255,.1)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:isDone?"#22c55e":isCurrent?"#fff":"rgba(255,255,255,.4)",
                fontSize:9,fontWeight:900,
              }}>
                {isDone ? "✓" : idx+1}
              </div>

              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ color:isCurrent?"#fff":"rgba(238,242,255,.8)",
                  fontWeight:isCurrent?700:500,fontSize:11,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {stop.clientName}
                </div>
                <div style={{ color:"rgba(238,242,255,.35)",fontSize:9,marginTop:1 }}>
                  {inputStop?.route ?? inputStop?.zone ?? inputStop?.address?.split(",")[0]}
                </div>
                <div style={{ color:"rgba(238,242,255,.25)",fontSize:9,marginTop:1 }}>
                  {totalItems} uds · {stop.serviceMinutes ?? 10} min est.
                </div>
              </div>

              {isCurrent && (
                <div style={{ flexShrink:0,width:6,height:6,borderRadius:"50%",
                  background:R,alignSelf:"center",boxShadow:`0 0 8px ${R}` }}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Almacén: inventory view (post-loading) ───────────────────────────────────
function WarehouseInventoryView({ routePlan, inputData, loadPlan,
  deliveredStopIds, currentStopId, selectedSlotId, truckViewMode,
  onSelectSlot, onChangeMode, onSelectStop, onConfirmDelivery }: {
  routePlan: RoutePlan; inputData: InputData; loadPlan: LoadPlan;
  deliveredStopIds: Set<string>; currentStopId: string;
  selectedSlotId: string|null; truckViewMode: ViewMode;
  onSelectSlot: (id:string|null)=>void; onChangeMode: (m:ViewMode)=>void;
  onSelectStop: (id:string)=>void;
  onConfirmDelivery: (id:string)=>void;
}) {
  const stops      = [...routePlan.stops].sort((a,b) => a.sequence - b.sequence);
  const totalSlots = loadPlan.palletSlots.length;

  // Slots still loaded (not yet at a delivered stop)
  const remainingSlots = loadPlan.palletSlots.filter(slot => {
    const stopId = slot.items?.[0]?.stopId;
    return stopId ? !deliveredStopIds.has(stopId) : true;
  });

  // Count returnables collected at delivered stops (items marked returnable)
  const returnablesCollected = [...deliveredStopIds].reduce((s, sid) => {
    const orders = inputData.orders.filter(o => o.stopId === sid);
    return s + orders.reduce((ss,o) =>
      ss + o.items.filter(i => i.returnable).reduce((sss,i)=>sss+i.quantity,0), 0);
  }, 0);

  // Empty pallet slots available for pickups
  const emptySlots = Math.max(0, (loadPlan.palletSlots.length ?? 8) - remainingSlots.length);

  const done  = deliveredStopIds.size;
  const total = stops.length;

  return (
    <div style={{ flex:1,minHeight:0,display:"flex",overflow:"hidden",
      fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* Left: 3D truck */}
      <div style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <TruckStage
          loadPlan={loadPlan}
          currentStopId={currentStopId}
          deliveredStopIds={deliveredStopIds}
          selectedSlotId={selectedSlotId}
          viewMode={truckViewMode}
          onSelectSlot={onSelectSlot}
          onChangeMode={onChangeMode}
        />
      </div>

      {/* Right: inventory panel */}
      <div style={{ width:280,flexShrink:0,background:"#0B1020",
        borderLeft:"1px solid rgba(255,255,255,.07)",
        display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* KPIs */}
        <div style={{ padding:"14px 12px", borderBottom:"1px solid rgba(255,255,255,.07)", flexShrink:0 }}>
          <div style={{ color:"rgba(238,242,255,.4)",fontSize:9,fontWeight:700,
            letterSpacing:.8,textTransform:"uppercase",marginBottom:10 }}>
            Estado del camión
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7 }}>
            {[
              { l:"Entregadas", v:`${done}/${total}`, c:"#22c55e",  i:"✅" },
              { l:"Palets restantes", v:`${remainingSlots.length}/${totalSlots}`, c:"#eef2ff", i:"📦" },
              { l:"Retornables",  v:returnablesCollected, c:"#14b8a6", i:"♻" },
              { l:"Huecos libres", v:emptySlots, c:emptySlots>2?"#22c55e":"#f59e0b", i:"🔲" },
            ].map(k => (
              <div key={k.l} style={{ background:"rgba(255,255,255,.03)",borderRadius:9,
                padding:"9px 10px",border:"1px solid rgba(255,255,255,.06)" }}>
                <div style={{ color:"rgba(238,242,255,.35)",fontSize:8,fontWeight:700,
                  letterSpacing:.4,textTransform:"uppercase" }}>{k.i} {k.l}</div>
                <div style={{ color:k.c,fontWeight:900,fontSize:20,lineHeight:1,marginTop:4,
                  fontVariantNumeric:"tabular-nums" }}>{k.v}</div>
              </div>
            ))}
          </div>

          {returnablesCollected > 0 && (
            <div style={{ marginTop:8,padding:"8px 10px",borderRadius:8,
              background:"rgba(20,184,166,.08)",border:"1px solid rgba(20,184,166,.2)" }}>
              <div style={{ color:"#14b8a6",fontSize:10,fontWeight:700 }}>
                ♻ {returnablesCollected} retornables cargados
              </div>
              <div style={{ color:"rgba(238,242,255,.35)",fontSize:9,marginTop:2 }}>
                {emptySlots > 0
                  ? `${emptySlots} huecos disponibles para más recogidas`
                  : "Camión completo — no más recogidas posibles"}
              </div>
            </div>
          )}
        </div>

        {/* Next delivery */}
        <div style={{ padding:"10px 12px 6px",flexShrink:0 }}>
          <div style={{ color:"rgba(238,242,255,.4)",fontSize:9,fontWeight:700,
            letterSpacing:.8,textTransform:"uppercase",marginBottom:6 }}>
            Paradas
          </div>
        </div>

        {/* Stop list */}
        <div style={{ flex:1,overflowY:"auto",padding:"0 10px 12px" }}>
          {stops.map((stop,idx) => {
            const isDone    = deliveredStopIds.has(stop.stopId);
            const isCurrent = stop.stopId === currentStopId && !isDone;
            const inputStop = inputData.stops.find(s => s.id === stop.stopId);

            return (
              <div key={stop.stopId}
                onClick={() => onSelectStop(stop.stopId)}
                style={{
                  display:"flex",gap:7,marginBottom:4,cursor:"pointer",
                  padding:"8px 9px",borderRadius:9,
                  background:isCurrent?"rgba(227,40,25,.1)":isDone?"rgba(34,197,94,.05)":"rgba(255,255,255,.02)",
                  border:`1px solid ${isCurrent?"rgba(227,40,25,.3)":isDone?"rgba(34,197,94,.18)":"rgba(255,255,255,.05)"}`,
                  opacity:isDone&&!isCurrent?0.55:1,
                }}>
                <div style={{ width:20,height:20,borderRadius:"50%",flexShrink:0,
                  background:isDone?"rgba(34,197,94,.2)":isCurrent?R:"rgba(255,255,255,.05)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:isDone?"#22c55e":isCurrent?"#fff":"rgba(255,255,255,.3)",
                  fontSize:8,fontWeight:900 }}>
                  {isDone?"✓":idx+1}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:isCurrent?"#fff":"rgba(238,242,255,.75)",
                    fontWeight:isCurrent?700:500,fontSize:10,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {stop.clientName}
                  </div>
                  <div style={{ color:"rgba(238,242,255,.3)",fontSize:8,marginTop:1 }}>
                    {inputStop?.route ?? inputStop?.zone}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function Dashboard() {
  const hybrid      = useMemo(() => buildHybrid(), []);
  const traditional = useMemo(() => buildTraditional(), []);

  const firstStop = useMemo(
    () => [...hybrid.routePlan.stops].sort((a,b) => a.sequence - b.sequence)[0],
    [hybrid],
  );

  const [mode,             setMode]           = useState<Mode>("driver");
  const [apiUp,            setApiUp]          = useState<boolean|null>(null);
  const [currentStopId,    setCurrentStopId]  = useState(firstStop?.stopId ?? "");
  const [deliveredStopIds, setDeliveredStopIds] = useState<Set<string>>(() => new Set());
  const [selectedSlotId,   setSelectedSlotId] = useState<string|null>(null);
  const [truckViewMode,    setTruckViewMode]  = useState<ViewMode>("general");
  const [driverPhase,      setDriverPhase]    = useState<DriverPhase>("ready");
  const [warehousePhase,   setWarehousePhase] = useState<WarehousePhase>("loading");
  const [truckCoord,       setTruckCoord]     = useState<LngLat|undefined>(undefined);

  // Share delivery state across modes so they stay in sync
  function handleConfirmDelivery(stopId: string) {
    const stop = hybrid.inputData.stops.find(s => s.id === stopId);
    if (stop?.lat && stop?.lng) {
      setTruckCoord(parkingCoord(stopId, stop.lat, stop.lng));
    }
    const updated = new Set(deliveredStopIds);
    updated.add(stopId);
    setDeliveredStopIds(updated);
    const sorted  = [...hybrid.routePlan.stops].sort((a,b) => a.sequence - b.sequence);
    const next    = sorted.find(s => !updated.has(s.stopId));
    if (next) setCurrentStopId(next.stopId);
    setTimeout(() => setDriverPhase("driving"), 300);
  }

  useEffect(() => {
    void checkApiHealth().then(setApiUp);
    const id = setInterval(() => void checkApiHealth().then(setApiUp), 12000);
    return () => clearInterval(id);
  }, []);

  // ── Supervisor ──────────────────────────────────────────────────────────
  if (mode === "supervisor") {
    return <SupervisorView onBack={() => setMode("driver")} />;
  }

  const subtitle = `DR0027 · ${hybrid.inputData.driver?.name} · ${deliveredStopIds.size}/${hybrid.routePlan.stops.length} entregadas`;

  // ── CONDUCTOR mode ──────────────────────────────────────────────────────
  if (mode === "driver") {
    const phaseBadge = (
      <>
        {driverPhase==="ready" && (
          <div style={{ padding:"4px 12px",borderRadius:20,
            border:`1px solid rgba(245,197,24,.4)`,background:"rgba(245,197,24,.1)",
            color:G,fontSize:11,fontWeight:700 }}>
            🟡 Listo para salir
          </div>
        )}
        {driverPhase==="driving" && (
          <div style={{ padding:"4px 12px",borderRadius:20,
            border:"1px solid rgba(59,130,246,.5)",background:"rgba(59,130,246,.1)",
            color:"#60a5fa",fontSize:11,fontWeight:700 }}>
            🚛 En ruta
          </div>
        )}
        {driverPhase==="parked" && (
          <div style={{ padding:"4px 12px",borderRadius:20,
            border:"1px solid rgba(16,185,129,.5)",background:"rgba(16,185,129,.1)",
            color:"#10b981",fontSize:11,fontWeight:700 }}>
            🅿 Descargando
          </div>
        )}
      </>
    );

    return (
      <div style={{ width:"100vw",height:"100vh",display:"flex",flexDirection:"column",
        background:"#060A12",overflow:"hidden" }}>
        <Header mode={mode} setMode={setMode} badge={phaseBadge} subtitle={subtitle}/>

        <div style={{ flex:1,minHeight:0 }}>
          {/* Delivery confirmation (full screen) */}
          {driverPhase === "parked" ? (
            <DeliveryView
              routePlan={hybrid.routePlan}
              inputData={hybrid.inputData}
              loadPlan={hybrid.loadPlan}
              currentStopId={currentStopId}
              deliveredStopIds={deliveredStopIds}
              onConfirm={handleConfirmDelivery}
            />
          ) : (
            /* Map + stop list */
            <div style={{ width:"100%",height:"100%",display:"flex" }}>
              {/* Map */}
              <div style={{ flex:1,minWidth:0 }}>
                {driverPhase === "driving" ? (
                  <RouteMap
                    routePlan={hybrid.routePlan}
                    inputData={hybrid.inputData}
                    currentStopId={currentStopId}
                    deliveredStopIds={deliveredStopIds}
                    startCoord={truckCoord}
                    onArrived={() => setDriverPhase("parked")}
                    onSelectStop={setCurrentStopId}
                  />
                ) : (
                  /* "ready" state: static map placeholder with iniciar overlay */
                  <RouteMap
                    routePlan={hybrid.routePlan}
                    inputData={hybrid.inputData}
                    currentStopId={currentStopId}
                    deliveredStopIds={deliveredStopIds}
                    startCoord={truckCoord}
                    onArrived={() => setDriverPhase("parked")}
                    onSelectStop={setCurrentStopId}
                  />
                )}
              </div>

              {/* Stop list panel */}
              <StopListPanel
                routePlan={hybrid.routePlan}
                inputData={hybrid.inputData}
                currentStopId={currentStopId}
                deliveredStopIds={deliveredStopIds}
                phase={driverPhase}
                onStart={() => setDriverPhase("driving")}
                onSelectStop={id => { setCurrentStopId(id); setDriverPhase("driving"); }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ALMACÉN mode ────────────────────────────────────────────────────────
  const warehouseBadge = (
    <>
      {warehousePhase==="loading" && (
        <div style={{ padding:"4px 12px",borderRadius:20,
          border:`1px solid rgba(245,197,24,.4)`,background:"rgba(245,197,24,.1)",
          color:G,fontSize:11,fontWeight:700 }}>
          📦 Cargando camión
        </div>
      )}
      {warehousePhase==="inventory" && (
        <div style={{ padding:"4px 12px",borderRadius:20,
          border:"1px solid rgba(20,184,166,.4)",background:"rgba(20,184,166,.08)",
          color:"#2dd4bf",fontSize:11,fontWeight:700 }}>
          🔄 Control de carga en ruta
        </div>
      )}
    </>
  );

  return (
    <div style={{ width:"100vw",height:"100vh",display:"flex",flexDirection:"column",
      background:"#060A12",overflow:"hidden" }}>
      <Header mode={mode} setMode={setMode} badge={warehouseBadge} subtitle={subtitle}/>

      <div style={{ flex:1,minHeight:0 }}>
        {warehousePhase === "loading" ? (
          <LoadingPhaseView
            inputData={hybrid.inputData}
            routePlan={hybrid.routePlan}
            loadPlan={hybrid.loadPlan}
            onStart={() => setWarehousePhase("inventory")}
          />
        ) : (
          <WarehouseInventoryView
            routePlan={hybrid.routePlan}
            inputData={hybrid.inputData}
            loadPlan={hybrid.loadPlan}
            deliveredStopIds={deliveredStopIds}
            currentStopId={currentStopId}
            selectedSlotId={selectedSlotId}
            truckViewMode={truckViewMode}
            onSelectSlot={setSelectedSlotId}
            onChangeMode={setTruckViewMode}
            onSelectStop={id => {
              setCurrentStopId(id);
              if (truckViewMode === "general") setTruckViewMode("next-stop");
            }}
            onConfirmDelivery={handleConfirmDelivery}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
