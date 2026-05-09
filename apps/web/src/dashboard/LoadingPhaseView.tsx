/**
 * LoadingPhaseView — pantalla de instrucciones de carga en almacén.
 *
 * Aparece ANTES de que el conductor salga del depósito.
 * Muestra exactamente qué poner en cada slot del camión, en qué orden,
 * dónde coger cada producto (ubicación almacén) y qué barriles vacíos cargar.
 *
 * Lógica: los slots con sequenceRange más ALTO se cargan PRIMERO (LIFO:
 * último en subir = primero en bajar al llegar a la primera parada).
 */
import { useMemo, useState } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import { TruckView3D } from "./truck3d/TruckView3D";

interface LoadingPhaseViewProps {
  inputData: InputData;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  onStart: () => void; // conductor confirma que el camión está cargado
}

const R = "#E32819";
const G = "#F5C842";
const D = "#0D0000";
const C = "#120000";
const B = "rgba(227,40,25,.15)";
const T = "rgba(255,255,255,.55)";

// Orden de carga: slot con sequence más alto (último en entregar) se carga primero
function loadingOrder(loadPlan: LoadPlan) {
  return [...loadPlan.palletSlots]
    .filter((s) => s.items.length > 0 || s.accessPriority === "returnables")
    .sort((a, b) => {
      const seqA = a.sequenceRange?.to ?? 0;
      const seqB = b.sequenceRange?.to ?? 0;
      return seqB - seqA; // mayor sequence = cargar primero
    });
}

function sideLabel(side: string) {
  const map: Record<string, string> = {
    left: "Lateral izquierdo",
    right: "Lateral derecho",
    rear: "Trasera",
    center: "Centro",
  };
  return map[side] ?? side;
}

function sideIcon(side: string) {
  const map: Record<string, string> = { left: "◀", right: "▶", rear: "⬇", center: "●" };
  return map[side] ?? "●";
}

// Deduplica ubicaciones de almacén: las sacamos del inputData via productId
function warehouseLocations(slot: LoadPlan["palletSlots"][number], inputData: InputData): string[] {
  const locs = new Set<string>();
  for (const item of slot.items) {
    // Buscar en orders el item por productId para obtener warehouseLocation
    for (const order of inputData.orders) {
      const found = order.items.find(i => i.productId === item.productId);
      if (found?.warehouseLocation) { locs.add(found.warehouseLocation); break; }
    }
  }
  return [...locs];
}

// Agrupa items por producto para mostrar totales
function groupItems(slot: LoadPlan["palletSlots"][number]) {
  const map = new Map<string, { name: string; qty: number; stopCount: number; stops: Set<string> }>();
  for (const item of slot.items) {
    const key = item.productId ?? item.clientName;
    if (!map.has(key)) map.set(key, { name: item.clientName, qty: 0, stopCount: 0, stops: new Set() });
    const entry = map.get(key)!;
    entry.qty += item.quantity ?? 1;
    entry.stops.add(item.stopId);
    entry.stopCount = entry.stops.size;
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

export function LoadingPhaseView({ inputData, routePlan, loadPlan, onStart }: LoadingPhaseViewProps) {
  const slots = useMemo(() => loadingOrder(loadPlan), [loadPlan]);
  const [checkedSlots, setCheckedSlots] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<string | null>(slots[0]?.slotId ?? null);

  const allChecked = checkedSlots.size >= slots.filter(s => s.items.length > 0).length;

  function toggleCheck(slotId: string) {
    setCheckedSlots(prev => {
      const n = new Set(prev);
      if (n.has(slotId)) n.delete(slotId); else n.add(slotId);
      return n;
    });
  }

  // Resumen de retornables a cargar
  const returnables = useMemo(() => {
    const plan = loadPlan.returnablesPlan;
    if (!plan) return null;
    return plan;
  }, [loadPlan]);

  // KPIs
  const kpis = loadPlan.kpis;
  const totalStops = routePlan.stops.length;
  const totalItems = loadPlan.palletSlots.reduce((s, sl) => s + sl.items.length, 0);

  return (
    <div style={{ width: "100%", height: "100%", background: D, display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden" }}>

      {/* ── Header ── */}
      <header style={{
        background: `linear-gradient(90deg,#0D0000 0%,#1a0000 60%,#0D0000 100%)`,
        borderBottom: `1px solid ${B}`,
        padding: "0 28px", height: 56, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 16px rgba(0,0,0,.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: R, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px rgba(227,40,25,.5)` }}>
            <svg width="22" height="22" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={G} /></svg>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: -.2 }}>Instrucciones de Carga</div>
            <div style={{ color: T, fontSize: 11 }}>
              {inputData.driver?.name ?? "Conductor"} · {inputData.vehicle.id} · Ruta {inputData.stops[0]?.route ?? "—"} · {totalStops} paradas · {totalItems} artículos
            </div>
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "Palets", value: slots.length },
            { label: "Ocupación", value: `${Math.round((kpis?.truckFillRatio ?? 0) * 100)}%` },
            { label: "Acceso directo", value: `${Math.round((kpis?.stopsWithDirectAccessRatio ?? 0) * 100)}%` },
          ].map(k => (
            <div key={k.label} style={{ textAlign: "center" }}>
              <div style={{ color: G, fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{k.value}</div>
              <div style={{ color: T, fontSize: 10, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          disabled={!allChecked}
          style={{
            padding: "10px 28px", borderRadius: 10, border: "none", cursor: allChecked ? "pointer" : "not-allowed",
            background: allChecked ? R : "#2a1a1a",
            color: allChecked ? "#fff" : "#555",
            fontWeight: 800, fontSize: 14, letterSpacing: .3,
            boxShadow: allChecked ? `0 0 20px rgba(227,40,25,.4)` : "none",
            transition: "all .2s",
          }}
        >
          {allChecked ? "🚛 Camión listo · Iniciar ruta" : `Confirma ${slots.filter(s => s.items.length > 0).length - checkedSlots.size} slots restantes`}
        </button>
      </header>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* ── Panel instrucciones (izquierda) ── */}
        <div style={{ width: 420, flexShrink: 0, borderRight: `1px solid ${B}`, overflowY: "auto", padding: "16px 0" }}>

          {/* Retornables a precargar */}
          {returnables && (returnables as any).estimatedPickups > 0 && (
            <div style={{ margin: "0 16px 16px", padding: "12px 16px", borderRadius: 10, background: "rgba(245,200,66,.08)", border: `1px solid rgba(245,200,66,.25)` }}>
              <div style={{ color: G, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>⬆ RETORNABLES A RECOGER (estimado)</div>
              <div style={{ color: "#e2e8f0", fontSize: 13 }}>
                ~{(returnables as any).estimatedPickups} envases vacíos · Slot reservado: <strong style={{ color: G }}>{(returnables as any).reservedSlotId ?? "P8"}</strong>
              </div>
            </div>
          )}

          {/* Orden de carga LIFO */}
          <div style={{ padding: "0 16px 8px", color: T, fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>
            ORDEN DE CARGA (1 = cargar primero)
          </div>

          {slots.map((slot, idx) => {
            const isActive = activeSlot === slot.slotId;
            const isChecked = checkedSlots.has(slot.slotId);
            const locs = warehouseLocations(slot, inputData);
            const grouped = groupItems(slot);
            const isEmpty = slot.items.length === 0;

            return (
              <div
                key={slot.slotId}
                onClick={() => { setActiveSlot(slot.slotId); }}
                style={{
                  margin: "0 12px 8px",
                  borderRadius: 12,
                  border: `1px solid ${isActive ? R : isChecked ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.07)"}`,
                  background: isActive ? "rgba(227,40,25,.07)" : isChecked ? "rgba(16,185,129,.05)" : C,
                  cursor: "pointer",
                  transition: "all .15s",
                  overflow: "hidden",
                }}
              >
                {/* Cabecera slot */}
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Check */}
                  <div
                    onClick={(e) => { e.stopPropagation(); if (!isEmpty) toggleCheck(slot.slotId); }}
                    style={{
                      width: 22, height: 22, borderRadius: 6, border: `2px solid ${isChecked ? "#10b981" : "rgba(255,255,255,.2)"}`,
                      background: isChecked ? "#10b981" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, cursor: isEmpty ? "default" : "pointer",
                    }}
                  >
                    {isChecked && <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>✓</span>}
                  </div>

                  {/* Número de orden */}
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: isActive ? R : "#1a0000", border: `1.5px solid ${isActive ? R : "rgba(227,40,25,.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                    {idx + 1}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{slot.slotId.toUpperCase()}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,.08)", color: T, fontSize: 10, fontWeight: 600 }}>
                        {sideIcon(slot.side)} {sideLabel(slot.side)}
                      </span>
                      {slot.accessPriority === "returnables" && (
                        <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(245,200,66,.12)", color: G, fontSize: 10, fontWeight: 700 }}>♻ Retornables</span>
                      )}
                    </div>
                    <div style={{ color: T, fontSize: 11, marginTop: 2 }}>
                      {isEmpty ? "Slot reservado · vacío" : `${slot.items.length} items · paradas ${slot.sequenceRange?.from ?? "?"}–${slot.sequenceRange?.to ?? "?"}`}
                    </div>
                  </div>
                </div>

                {/* Detalles expandidos cuando activo */}
                {isActive && !isEmpty && (
                  <div style={{ borderTop: `1px solid rgba(227,40,25,.15)`, padding: "10px 14px 12px" }}>

                    {/* Ubicaciones almacén */}
                    {locs.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ color: G, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 4 }}>📍 RECOGER EN ALMACÉN</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {locs.map(loc => (
                            <span key={loc} style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(245,200,66,.12)", color: G, fontSize: 12, fontWeight: 700 }}>{loc}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de productos */}
                    <div style={{ color: T, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 6 }}>CONTENIDO DEL PALET</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {grouped.slice(0, 8).map((g, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#e2e8f0" }}>{g.name}</span>
                          <span style={{ color: T }}>×{g.qty} <span style={{ fontSize: 10 }}>({g.stopCount} parada{g.stopCount !== 1 ? "s" : ""})</span></span>
                        </div>
                      ))}
                      {grouped.length > 8 && <div style={{ color: T, fontSize: 11 }}>+{grouped.length - 8} más...</div>}
                    </div>

                    {/* Paradas que descarga este slot */}
                    <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                      <div style={{ color: T, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 4 }}>PARADAS QUE CUBRE</div>
                      {[...new Set(slot.items.map(it => it.stopId))].map(sid => {
                        const stop = inputData.stops.find(s => s.id === sid);
                        const rStop = routePlan.stops.find(s => s.stopId === sid);
                        return (
                          <div key={sid} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ width: 20, height: 20, borderRadius: "50%", background: R, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, flexShrink: 0 }}>
                              {rStop?.sequence ?? "?"}
                            </span>
                            <span style={{ color: "#e2e8f0", fontSize: 11 }}>{stop?.clientName ?? sid}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Vista 3D camión (derecha) ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Mini mapa de carga del camión */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <TruckView3D
              loadPlan={loadPlan}
              currentStopId={null}
              deliveredStopIds={new Set()}
              selectedSlotId={activeSlot}
              viewMode="general"
              onSelectSlot={(id) => setActiveSlot(id)}
            />
          </div>

          {/* Panel resumen de carga total */}
          <div style={{ borderTop: `1px solid ${B}`, padding: "14px 24px", background: C, display: "flex", gap: 24, flexWrap: "wrap" }}>
            {loadPlan.explanation?.slice(0, 4).map((line, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: T, fontSize: 12 }}>
                <span style={{ color: R, fontWeight: 700 }}>▸</span>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
