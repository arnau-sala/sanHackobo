/**
 * LoadingPhaseView — instrucciones de carga para el almacenero.
 * Diseño premium Damm: fondo cálido, tarjetas blancas, sin fondo negro.
 * LIFO: el slot con sequenceRange más alto se carga primero.
 */
import { useMemo, useState } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import { TruckView3D } from "./truck3d/TruckView3D";

interface LoadingPhaseViewProps {
  inputData: InputData;
  routePlan: RoutePlan;
  loadPlan: LoadPlan;
  onStart: () => void;
}

function loadingOrder(loadPlan: LoadPlan) {
  return [...loadPlan.palletSlots]
    .filter((s) => s.items.length > 0 || s.accessPriority === "returnables")
    .sort((a, b) => (b.sequenceRange?.to ?? 0) - (a.sequenceRange?.to ?? 0));
}

const SIDE_LABEL: Record<string, string> = {
  left: "Lateral izq.",
  right: "Lateral der.",
  rear: "Trasera",
  center: "Centro",
};

const SIDE_COLOR: Record<string, string> = {
  left:   "#3b82f6",
  right:  "#8b5cf6",
  rear:   "#f59e0b",
  center: "#10b981",
};

function warehouseLocations(slot: LoadPlan["palletSlots"][number], inputData: InputData): string[] {
  const locs = new Set<string>();
  for (const item of slot.items) {
    for (const order of inputData.orders) {
      const found = order.items.find((i) => i.productId === item.productId);
      if (found?.warehouseLocation) { locs.add(found.warehouseLocation); break; }
    }
  }
  return [...locs];
}

function groupItems(slot: LoadPlan["palletSlots"][number]) {
  const map = new Map<string, { name: string; qty: number; stops: Set<string> }>();
  for (const item of slot.items) {
    const key = item.productId ?? item.clientName;
    if (!map.has(key)) map.set(key, { name: item.clientName, qty: 0, stops: new Set() });
    const entry = map.get(key)!;
    entry.qty += item.quantity ?? 1;
    entry.stops.add(item.stopId);
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

// Icono de posición del slot dentro del camión
function SlotPositionBadge({ side, slotId }: { side: string; slotId: string }) {
  const color = SIDE_COLOR[side] ?? "#6b7280";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 20,
      background: `${color}18`, border: `1px solid ${color}40`,
      color, fontSize: 10, fontWeight: 700,
    }}>
      {SIDE_LABEL[side] ?? side}
    </span>
  );
}

export function LoadingPhaseView({ inputData, routePlan, loadPlan, onStart }: LoadingPhaseViewProps) {
  const slots = useMemo(() => loadingOrder(loadPlan), [loadPlan]);
  const [checkedSlots, setCheckedSlots] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<string | null>(slots[0]?.slotId ?? null);

  const loadableSlots = slots.filter((s) => s.items.length > 0);
  const allChecked = checkedSlots.size >= loadableSlots.length;

  function toggleCheck(slotId: string) {
    setCheckedSlots((prev) => {
      const n = new Set(prev);
      if (n.has(slotId)) n.delete(slotId); else n.add(slotId);
      return n;
    });
  }

  const returnables = loadPlan.returnablesPlan;
  const kpis = loadPlan.kpis;
  const totalStops = routePlan.stops.length;

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(180deg,#fbf8f4 0%,#f4efe8 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter',system-ui,sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <header style={{
        background: "#ffffff",
        borderBottom: "1px solid #e7e2dd",
        padding: "0 24px", height: 58, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 0 rgba(255,255,255,.6) inset, 0 2px 8px rgba(17,17,17,.06)",
      }}>
        {/* Logo + título */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#e10600",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(225,6,0,.3)",
          }}>
            <svg width="20" height="20" viewBox="0 0 22 22">
              <polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill="#f5c842" />
            </svg>
          </div>
          <div>
            <div style={{ color: "#0f1115", fontWeight: 800, fontSize: 15, letterSpacing: -.3 }}>
              Instrucciones de Carga
            </div>
            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
              {inputData.driver?.name ?? "Almacén"} · {inputData.vehicle.id} · {totalStops} paradas
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "Palets", value: slots.length, color: "#e10600" },
            { label: "Ocupación", value: `${Math.round((kpis?.truckFillRatio ?? 0) * 100)}%`, color: "#0f1115" },
            { label: "Acceso directo", value: `${Math.round((kpis?.stopsWithDirectAccessRatio ?? 0) * 100)}%`, color: "#16a34a" },
          ].map((k) => (
            <div key={k.label} style={{
              textAlign: "center", padding: "6px 16px",
              background: "#f8fafc", borderRadius: 10,
              border: "1px solid #e7e2dd",
            }}>
              <div style={{ color: k.color, fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{k.value}</div>
              <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Botón confirmar */}
        <button
          onClick={onStart}
          disabled={!allChecked}
          style={{
            padding: "11px 24px", borderRadius: 10, border: "none",
            cursor: allChecked ? "pointer" : "not-allowed",
            background: allChecked
              ? "linear-gradient(135deg,#e10600,#b00500)"
              : "#f3f4f6",
            color: allChecked ? "#fff" : "#9ca3af",
            fontWeight: 800, fontSize: 13, letterSpacing: .2,
            boxShadow: allChecked ? "0 4px 16px rgba(225,6,0,.35)" : "none",
            transition: "all .2s",
            whiteSpace: "nowrap",
          }}
        >
          {allChecked
            ? "Camion listo · Iniciar ruta"
            : `Confirma ${loadableSlots.length - checkedSlots.size} slot${loadableSlots.length - checkedSlots.size !== 1 ? "s" : ""} restantes`}
        </button>
      </header>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* ── Panel izquierdo: instrucciones ── */}
        <div style={{
          width: 400, flexShrink: 0,
          borderRight: "1px solid #e7e2dd",
          overflowY: "auto", padding: "14px 12px",
          background: "#ffffff",
        }}>

          {/* Banner retornables */}
          {returnables && (returnables as { estimatedPickups?: number; reservedSlotId?: string }).estimatedPickups! > 0 && (
            <div style={{
              marginBottom: 12, padding: "10px 14px", borderRadius: 10,
              background: "rgba(245,200,66,.1)", border: "1px solid rgba(245,200,66,.4)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>♻</span>
              <div>
                <div style={{ color: "#92600a", fontWeight: 700, fontSize: 11 }}>RETORNABLES A RECOGER</div>
                <div style={{ color: "#0f1115", fontSize: 12 }}>
                  ~{(returnables as { estimatedPickups?: number; reservedSlotId?: string }).estimatedPickups} envases ·
                  Slot <strong>{(returnables as { estimatedPickups?: number; reservedSlotId?: string }).reservedSlotId ?? "P8"}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Progreso visual */}
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e7e2dd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>PROGRESO DE CARGA</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f1115" }}>
                {checkedSlots.size} / {loadableSlots.length} slots
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "#e7e2dd", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: "linear-gradient(90deg,#e10600,#f5c842)",
                width: `${loadableSlots.length > 0 ? (checkedSlots.size / loadableSlots.length) * 100 : 0}%`,
                transition: "width .3s ease",
              }} />
            </div>
          </div>

          {/* Encabezado lista */}
          <div style={{ padding: "0 4px 8px", color: "#9ca3af", fontSize: 10, letterSpacing: .6, fontWeight: 700 }}>
            ORDEN DE CARGA — 1 PRIMERO (LIFO)
          </div>

          {slots.map((slot, idx) => {
            const isActive  = activeSlot === slot.slotId;
            const isChecked = checkedSlots.has(slot.slotId);
            const isEmpty   = slot.items.length === 0;
            const locs      = warehouseLocations(slot, inputData);
            const grouped   = groupItems(slot);
            const sideColor = SIDE_COLOR[slot.side] ?? "#6b7280";

            return (
              <div
                key={slot.slotId}
                onClick={() => setActiveSlot(slot.slotId)}
                style={{
                  marginBottom: 8, borderRadius: 12, cursor: "pointer",
                  border: `1.5px solid ${isActive ? "#e10600" : isChecked ? "#16a34a" : "#e7e2dd"}`,
                  background: isActive ? "rgba(225,6,0,.03)" : isChecked ? "rgba(22,163,74,.04)" : "#fff",
                  boxShadow: isActive
                    ? "0 2px 12px rgba(225,6,0,.12)"
                    : "0 1px 3px rgba(17,17,17,.05)",
                  transition: "all .15s", overflow: "hidden",
                }}
              >
                {/* Barra lateral de color por side */}
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, background: sideColor, borderRadius: "12px 0 0 12px", flexShrink: 0 }} />

                  <div style={{ flex: 1, padding: "10px 12px" }}>
                    {/* Fila cabecera */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                      {/* Checkbox */}
                      <div
                        onClick={(e) => { e.stopPropagation(); if (!isEmpty) toggleCheck(slot.slotId); }}
                        style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${isChecked ? "#16a34a" : "#d1d5db"}`,
                          background: isChecked ? "#16a34a" : "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: isEmpty ? "default" : "pointer",
                          transition: "all .15s",
                        }}
                      >
                        {isChecked && (
                          <svg width="11" height="11" viewBox="0 0 12 12">
                            <polyline points="2,6 5,9 10,3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Número orden */}
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                        background: isActive ? "#e10600" : "#f3f4f6",
                        color: isActive ? "#fff" : "#6b7280",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, fontSize: 12,
                      }}>
                        {idx + 1}
                      </div>

                      {/* Slot ID */}
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#0f1115" }}>
                        {slot.slotId.toUpperCase()}
                      </span>

                      <SlotPositionBadge side={slot.side} slotId={slot.slotId} />

                      {slot.accessPriority === "returnables" && (
                        <span style={{
                          padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: "rgba(245,200,66,.15)", color: "#92600a",
                        }}>♻ Retornables</span>
                      )}
                    </div>

                    {/* Subtítulo */}
                    <div style={{ marginTop: 4, color: "#6b7280", fontSize: 11, paddingLeft: 56 }}>
                      {isEmpty
                        ? "Slot reservado · vacío"
                        : `${slot.items.length} items · paradas ${slot.sequenceRange?.from ?? "?"}–${slot.sequenceRange?.to ?? "?"}`}
                    </div>

                    {/* Detalle expandido */}
                    {isActive && !isEmpty && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>

                        {/* Ubicaciones almacén — lo más importante */}
                        {locs.length > 0 && (
                          <div style={{
                            marginBottom: 10, padding: "8px 12px", borderRadius: 8,
                            background: "rgba(245,200,66,.08)", border: "1px solid rgba(245,200,66,.3)",
                          }}>
                            <div style={{ color: "#92600a", fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 6 }}>
                              RECOGER EN ALMACEN
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {locs.map((loc) => (
                                <span key={loc} style={{
                                  padding: "4px 12px", borderRadius: 6,
                                  background: "#f5c842", color: "#0f1115",
                                  fontSize: 13, fontWeight: 800, letterSpacing: .2,
                                }}>
                                  {loc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Contenido del palet */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 6 }}>
                            CONTENIDO DEL PALET
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {grouped.slice(0, 8).map((g, i) => (
                              <div key={i} style={{
                                display: "flex", justifyContent: "space-between",
                                alignItems: "center", padding: "3px 0",
                                borderBottom: "1px solid #f3f4f6",
                              }}>
                                <span style={{ color: "#0f1115", fontSize: 12 }}>{g.name}</span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{
                                    fontWeight: 800, fontSize: 13, color: "#e10600",
                                    minWidth: 28, textAlign: "right",
                                  }}>×{g.qty}</span>
                                  <span style={{ color: "#9ca3af", fontSize: 10 }}>
                                    {g.stops.size} par.
                                  </span>
                                </div>
                              </div>
                            ))}
                            {grouped.length > 8 && (
                              <div style={{ color: "#9ca3af", fontSize: 11, textAlign: "right" }}>
                                +{grouped.length - 8} productos mas
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Paradas que cubre */}
                        <div style={{
                          padding: "8px 10px", borderRadius: 8,
                          background: "#f8fafc", border: "1px solid #e7e2dd",
                        }}>
                          <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 6 }}>
                            PARADAS QUE CUBRE ESTE SLOT
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {[...new Set(slot.items.map((it) => it.stopId))].map((sid) => {
                              const stop  = inputData.stops.find((s) => s.id === sid);
                              const rStop = routePlan.stops.find((s) => s.stopId === sid);
                              return (
                                <div key={sid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    background: "#e10600", color: "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 9, fontWeight: 900, flexShrink: 0,
                                  }}>
                                    {rStop?.sequence ?? "?"}
                                  </div>
                                  <span style={{ color: "#0f1115", fontSize: 11 }}>
                                    {stop?.clientName ?? sid}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Panel derecho: camión 3D + leyenda ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Leyenda de colores por lateral */}
          <div style={{
            padding: "10px 20px", background: "#fff",
            borderBottom: "1px solid #e7e2dd",
            display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
          }}>
            <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>POSICION EN CAMION:</span>
            {Object.entries(SIDE_LABEL).map(([side, label]) => (
              <div key={side} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: SIDE_COLOR[side] }} />
                <span style={{ fontSize: 11, color: "#4b5563" }}>{label}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#16a34a" }} />
                <span style={{ fontSize: 11, color: "#4b5563" }}>Slot confirmado</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#e10600" }} />
                <span style={{ fontSize: 11, color: "#4b5563" }}>Slot activo</span>
              </div>
            </div>
          </div>

          {/* Vista 3D */}
          <div style={{
            flex: 1, minHeight: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
            background:
              "radial-gradient(800px 400px at 50% 50%, rgba(225,6,0,.04), transparent 70%)," +
              "repeating-linear-gradient(0deg,rgba(15,17,21,.012) 0 1px,transparent 1px 22px)," +
              "repeating-linear-gradient(90deg,rgba(15,17,21,.012) 0 1px,transparent 1px 22px)," +
              "linear-gradient(180deg,#fbf8f4 0%,#f4efe8 100%)",
          }}>
            <TruckView3D
              loadPlan={loadPlan}
              currentStopId={null}
              deliveredStopIds={new Set()}
              selectedSlotId={activeSlot}
              viewMode="general"
              onSelectSlot={(id) => setActiveSlot(id)}
            />
          </div>

          {/* Notas de estrategia */}
          {loadPlan.explanation && loadPlan.explanation.length > 0 && (
            <div style={{
              borderTop: "1px solid #e7e2dd",
              padding: "12px 20px",
              background: "#fff",
              display: "flex", gap: 20, flexWrap: "wrap",
            }}>
              {loadPlan.explanation.slice(0, 4).map((line, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: "1 1 200px" }}>
                  <span style={{ color: "#e10600", fontWeight: 800, marginTop: 1 }}>▸</span>
                  <span style={{ color: "#4b5563", fontSize: 11, lineHeight: 1.4 }}>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
