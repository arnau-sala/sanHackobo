/**
 * DeliveryView — pantalla completa de descarga en parada.
 * Estética premium marca Damm: rojo #E32819, dorado #F5C842, negro profundo.
 */
import { useMemo } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import { TruckView3D } from "./truck3d/TruckView3D";
import { paletteFor } from "./truck3d/productColors";

interface DeliveryViewProps {
  routePlan: RoutePlan;
  inputData: InputData;
  loadPlan: LoadPlan;
  currentStopId: string;
  deliveredStopIds: Set<string>;
  onConfirm: (stopId: string) => void;
}

const DAMM_RED  = "#E32819";
const DAMM_GOLD = "#F5C842";
const DAMM_DARK = "#0D0000";
const DAMM_CARD = "#140000";
const DAMM_LINE = "rgba(227,40,25,.18)";

export function DeliveryView({ routePlan, inputData, loadPlan, currentStopId, deliveredStopIds, onConfirm }: DeliveryViewProps) {
  const stopInfo  = useMemo(() => inputData.stops.find((s) => s.id === currentStopId), [inputData, currentStopId]);
  const routeStop = useMemo(() => routePlan.stops.find((s) => s.stopId === currentStopId), [routePlan, currentStopId]);
  const order     = useMemo(() => inputData.orders.find((o) => o.stopId === currentStopId), [inputData, currentStopId]);

  const slotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of loadPlan.palletSlots)
      if (slot.items.some((it) => it.stopId === currentStopId)) ids.add(slot.slotId);
    return ids;
  }, [loadPlan, currentStopId]);

  const totalItems   = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const hasReturnables = order?.items.some((i) => i.name.toLowerCase().includes("ret")) ?? false;
  const seqNum       = routeStop?.sequence ?? "?";
  const totalPending = routePlan.stops.filter((s) => !deliveredStopIds.has(s.stopId)).length;

  return (
    <div style={{ width: "100%", height: "100%", background: DAMM_DARK, display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg,${DAMM_DARK} 0%,#2a0000 40%,#1a0000 100%)`,
        borderBottom: `1px solid ${DAMM_LINE}`,
        padding: "14px 28px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 18,
        boxShadow: "0 4px 24px rgba(0,0,0,.7)",
      }}>
        {/* Número de parada */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
          background: DAMM_RED, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 22,
          border: `2.5px solid ${DAMM_GOLD}`,
          boxShadow: `0 0 20px rgba(227,40,25,.5)`,
        }}>
          {seqNum}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: DAMM_GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>
            🅿 Aparcado · Zona de descarga oficial
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, lineHeight: 1.2, letterSpacing: -.2 }}>
            {stopInfo?.clientName ?? routeStop?.clientName}
          </div>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 3 }}>
            📍 {stopInfo?.address ?? ""}{routeStop?.arrivalEta ? ` · ETA ${routeStop.arrivalEta}` : ""}
          </div>
        </div>

        {/* Stats header derecha */}
        <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>{totalItems}</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>unidades</div>
          </div>
          <div style={{ width: 1, background: DAMM_LINE }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ color: DAMM_GOLD, fontWeight: 900, fontSize: 26, lineHeight: 1 }}>{totalPending - 1}</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>restantes</div>
          </div>
          <div style={{ width: 1, background: DAMM_LINE }} />
          <div style={{ textAlign: "center" }}>
            {[...slotIds].map((s) => (
              <span key={s} style={{ display: "inline-block", margin: "2px 3px", padding: "3px 8px", background: DAMM_RED, color: "#fff", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>{s}</span>
            ))}
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>palets</div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* ─ Panel izquierdo: artículos ─ */}
        <div style={{ width: 300, flexShrink: 0, background: DAMM_CARD, borderRight: `1px solid ${DAMM_LINE}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${DAMM_LINE}` }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: .2 }}>📦 Artículos a descargar</div>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 2 }}>
              {order?.paymentType} · {order?.items.length} referencias
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {order?.items.map((item) => {
              const pal = paletteFor(item.productId, item.name);
              const isRet = item.name.toLowerCase().includes("ret");
              return (
                <div key={item.productId} style={{
                  padding: "11px 18px", borderBottom: `1px solid ${DAMM_LINE}`,
                  display: "flex", alignItems: "center", gap: 12,
                  background: isRet ? "rgba(245,200,66,.04)" : "transparent",
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: pal.swatch, flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,.4)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f3f4f6", fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                      {item.name.replace(/\s+RET\.?\s*PP$/i, "").trim()}
                      {isRet && <span style={{ marginLeft: 5, fontSize: 9, background: DAMM_GOLD, color: "#000", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>RET</span>}
                    </div>
                    <div style={{ color: "rgba(255,255,255,.35)", fontSize: 10, marginTop: 1 }}>{item.warehouseLocation} · {item.unit}</div>
                  </div>
                  <div style={{ flexShrink: 0, background: DAMM_RED, color: "#fff", fontWeight: 900, fontSize: 15, borderRadius: 7, padding: "4px 11px", minWidth: 38, textAlign: "center" }}>
                    {item.quantity}
                  </div>
                </div>
              );
            })}
          </div>

          {hasReturnables && (
            <div style={{ padding: "12px 18px", background: "rgba(245,200,66,.07)", borderTop: `1px solid rgba(245,200,66,.2)` }}>
              <div style={{ color: DAMM_GOLD, fontSize: 12, fontWeight: 800 }}>⚠ Recoger retornables</div>
              <div style={{ color: "rgba(245,200,66,.6)", fontSize: 11, marginTop: 3 }}>Verificar y anotar cajas vacías devueltas</div>
            </div>
          )}
        </div>

        {/* ─ Centro: camión 3D ─ */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative", background: "#0a0000" }}>
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 5 }}>
            <div style={{ background: "rgba(8,0,0,.88)", border: `1px solid ${DAMM_LINE}`, borderRadius: 8, padding: "5px 16px", fontSize: 11, color: "rgba(255,255,255,.45)", whiteSpace: "nowrap" }}>
              Palets en rojo = los de esta parada · Toca para ver detalle
            </div>
          </div>
          <div style={{ width: "100%", height: "100%" }}>
            <TruckView3D
              loadPlan={loadPlan}
              deliveredStopIds={deliveredStopIds}
              currentStopId={currentStopId}
              selectedSlotId={null}
              onSelectSlot={() => {}}
              viewMode="next-stop"
            />
          </div>
        </div>

        {/* ─ Panel derecho: checklist + confirmar ─ */}
        <div style={{ width: 250, flexShrink: 0, background: DAMM_CARD, borderLeft: `1px solid ${DAMM_LINE}`, display: "flex", flexDirection: "column", padding: "20px 18px", gap: 16 }}>

          {/* Palets */}
          <div>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Palets implicados</div>
            {[...slotIds].map((sid) => {
              const slot  = loadPlan.palletSlots.find((p) => p.slotId === sid);
              const items = slot?.items.filter((it) => it.stopId === currentStopId) ?? [];
              return (
                <div key={sid} style={{ background: "rgba(227,40,25,.12)", border: `1px solid rgba(227,40,25,.3)`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ color: DAMM_GOLD, fontWeight: 900, fontSize: 16 }}>{sid}</div>
                  <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 2 }}>{items.length} referencia{items.length !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          {/* Checklist */}
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${DAMM_LINE}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: .5 }}>Checklist parada</div>
            {[
              "Descargar artículos indicados",
              hasReturnables ? "Recoger retornables" : null,
              "Obtener firma/albarán",
              "Cerrar y asegurar camión",
            ].filter(Boolean).map((item) => (
              <div key={item as string} style={{ color: "rgba(255,255,255,.45)", fontSize: 11, marginBottom: 7, display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid rgba(227,40,25,.5)`, flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>

          {/* Botón confirmar */}
          <button
            onClick={() => onConfirm(currentStopId)}
            style={{
              width: "100%", padding: "18px 0",
              background: `linear-gradient(135deg,${DAMM_RED} 0%,#b01000 100%)`,
              color: "#fff", border: `1.5px solid ${DAMM_GOLD}`,
              borderRadius: 14, fontWeight: 900, fontSize: 17,
              cursor: "pointer", letterSpacing: .5, lineHeight: 1.3,
              boxShadow: `0 8px 28px rgba(227,40,25,.5)`,
              transition: "transform .1s, box-shadow .1s",
            }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(.97)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            ✓ ENTREGA<br/>CONFIRMADA
          </button>
        </div>
      </div>
    </div>
  );
}
