/**
 * Panel de pestañas (derecha) del camión: Palets | Entregas
 * - Pestaña Palets: lista de palets + detalles al seleccionar
 * - Pestaña Entregas: lista de entregas + detalles al seleccionar
 */
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import type { PalletStackInfo } from "./buildPalletStack";
import { paletteFor } from "./productColors";
import { ACCENT_BY_TYPE, BRANDS } from "./figmaBrands";
import type { RenderPallet } from "./palletRenderModel";
import styles from "./TruckView3D.module.css";

export type TruckDetailTabsProps = {
  tab: "palets" | "deliveries";
  selectedItem: string | null;
  loadPlan: LoadPlan;
  routePlan: RoutePlan;
  inputData: InputData;
  deliveredStopIds: Set<string>;
  stacks: Map<string, PalletStackInfo>;
  renders: Map<string, RenderPallet>;
  onTabChange: (tab: "palets" | "deliveries") => void;
  onItemSelect: (item: string | null) => void;
};

export function TruckDetailTabs({
  tab,
  selectedItem,
  loadPlan,
  routePlan,
  inputData,
  deliveredStopIds,
  stacks,
  renders,
  onTabChange,
  onItemSelect,
}: TruckDetailTabsProps) {
  const stopsById = new Map(inputData.stops.map((s) => [s.id, s]));
  const ordersByStop = new Map<string, (typeof inputData.orders)[number]>();
  for (const o of inputData.orders) ordersByStop.set(o.stopId, o);

  const sortedStops = [...routePlan.stops].sort(
    (a, b) => a.sequence - b.sequence,
  );

  // ── SVG icons compartidos para los detalles ──
  const IcoX = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
  const IcoPin = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
  const IcoClockSm = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  const IcoCheckSm = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  const IcoCash = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
  const IcoBox = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  );
  const IcoWeight = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/><path d="M16 8H8l-4 12h16z"/>
    </svg>
  );
  const IcoLayers = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  );

  const closeBtnStyle: React.CSSProperties = {
    position: "absolute", top: 0, right: 0,
    width: 30, height: 30, borderRadius: 8,
    border: "1px solid var(--border,#e7e2dd)",
    background: "linear-gradient(180deg,#ffffff,#f6f1e7)",
    color: "var(--t2,#4b5563)",
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(17,17,17,.04)",
    transition: "all .15s ease",
  };

  const statBoxStyle: React.CSSProperties = {
    position: "relative",
    background: "linear-gradient(180deg,#ffffff,#fbf9f6)",
    border: "1px solid var(--border,#e7e2dd)",
    borderRadius: 11,
    padding: "9px 11px 10px",
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 1px 2px rgba(17,17,17,.03)",
  };

  // Si está seleccionado un item, mostrar detalles
  if (selectedItem) {
    if (tab === "palets") {
      const slot = loadPlan.palletSlots.find((s) => s.slotId === selectedItem);
      if (!slot) return null;
      const stack = stacks.get(selectedItem);
      const render = renders.get(selectedItem);
      if (!stack || !render) return null;
      const col0Brand = BRANDS[render.cols[0].brandKey];
      const col1Brand = BRANDS[render.cols[1].brandKey];
      const accent = render.accentColor;

      return (
        <aside className={styles.palletDetailColumn} aria-label="Detalle del palet">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", position: "relative" }}>

            {/* Botón cerrar */}
            <button onClick={() => onItemSelect(null)} style={closeBtnStyle} aria-label="Cerrar">
              {IcoX}
            </button>

            {/* ── Hero del palet ── */}
            <div style={{
              position: "relative",
              padding: "16px 14px 14px 14px",
              marginRight: 38,
              marginBottom: 10,
              background: `linear-gradient(180deg,${accent}10 0%,transparent 100%)`,
              borderRadius: 12,
              border: `1px solid ${accent}22`,
              overflow: "hidden",
            }}>
              {/* Hairline dorado */}
              <span style={{
                position: "absolute", left: 14, right: 14, top: 0, height: 1,
                background: "linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)",
              }}/>
              {/* Badge ID */}
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: `linear-gradient(180deg,${accent}cc,${accent})`,
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 14,
                  letterSpacing: "-.01em",
                  border: `1px solid ${accent}`,
                  boxShadow: `0 6px 14px ${accent}55, inset 0 1px 0 rgba(255,255,255,.3)`,
                  textShadow: "0 1px 1px rgba(0,0,0,.18)",
                }}>
                  {slot.slotId}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: "var(--t3,#6b7280)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 1 }}>
                    Palet · slot
                  </div>
                  <div style={{ color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 16, letterSpacing: "-.015em", lineHeight: 1 }}>
                    {render.typeLabel}
                  </div>
                </div>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                color: "var(--t2,#4b5563)", fontSize: 10, fontWeight: 600,
              }}>
                <span style={{ color: accent, lineHeight: 0 }}>{IcoLayers}</span>
                <span>{render.sideStr}</span>
                <span style={{ color: "var(--t3,#6b7280)" }}>·</span>
                <span>{render.stops}</span>
              </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              <div style={statBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--t3,#6b7280)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  <span style={{ color: accent, lineHeight: 0 }}>{IcoBox}</span>
                  Categoría
                </div>
                <div style={{ color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 13, marginTop: 4, letterSpacing: "-.005em" }}>
                  {stack.category}
                </div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--t3,#6b7280)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  <span style={{ color: accent, lineHeight: 0 }}>{IcoLayers}</span>
                  Ocupación
                </div>
                <div style={{
                  color: accent, fontWeight: 900, fontSize: 18,
                  marginTop: 2, letterSpacing: "-.02em",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {render.occupancy}<span style={{ fontSize: 11 }}>%</span>
                </div>
                <div style={{
                  marginTop: 4, height: 4, borderRadius: 999,
                  background: "linear-gradient(180deg,#ece4d8,#f3eee5)",
                  border: "1px solid var(--border2,#efeae3)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: `${Math.min(100, render.occupancy)}%`,
                    background: `linear-gradient(90deg,${accent}cc,${accent})`,
                    borderRadius: 999,
                    boxShadow: `0 0 6px ${accent}55`,
                    transition: "width .5s",
                  }}/>
                </div>
              </div>
            </div>

            {/* ── Marcas ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 11 }}>
              {[col0Brand, col1Brand].map((b, i) => (
                <div key={i} style={{
                  flex: 1,
                  background: `linear-gradient(180deg,${b.top}1a 0%,${b.top}08 100%)`,
                  border: `1px solid ${b.top}40`,
                  borderRadius: 10,
                  padding: "8px 8px 8px",
                  textAlign: "center",
                  position: "relative",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45)",
                  overflow: "hidden",
                }}>
                  <span style={{
                    position: "absolute", left: 8, right: 8, top: 0, height: 1,
                    background: `linear-gradient(90deg,transparent,${b.top}66,transparent)`,
                  }}/>
                  <div style={{
                    width: 14, height: 14, borderRadius: 4,
                    background: `linear-gradient(180deg,${b.top},${b.top}cc)`,
                    margin: "0 auto 5px",
                    boxShadow: `0 2px 5px ${b.top}55, inset 0 1px 0 rgba(255,255,255,.25)`,
                  }}/>
                  <div style={{
                    fontSize: 9, color: "var(--t1,#0f1115)", fontWeight: 800,
                    lineHeight: 1, letterSpacing: ".06em", textTransform: "uppercase",
                  }}>
                    {b.abbr}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Productos ── */}
            <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingRight: 2 }}>
              <div style={{
                color: "var(--t3,#6b7280)", fontSize: 9, fontWeight: 800,
                marginBottom: 6, textTransform: "uppercase", letterSpacing: ".1em",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{
                  flex: 1, height: 1,
                  background: "linear-gradient(90deg,transparent,var(--border,#e7e2dd))",
                }}/>
                Productos
                <span style={{
                  flex: 1, height: 1,
                  background: "linear-gradient(90deg,var(--border,#e7e2dd),transparent)",
                }}/>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {render.products.length === 0 ? (
                  <div style={{
                    fontSize: 10, color: "var(--t3,#6b7280)", fontStyle: "italic",
                    textAlign: "center", padding: "16px 8px",
                    background: "var(--bg2,#f8fafc)",
                    border: "1px dashed var(--border,#e7e2dd)",
                    borderRadius: 10,
                  }}>
                    {render.typeLabel === "Retornables" ? "Espacio para envases retornables" : "Palet vacío"}
                  </div>
                ) : (
                  render.products.map((prod, i) => {
                    const brandColor = BRANDS[render.cols[Math.min(i, 1)].brandKey].top;
                    return (
                      <div
                        key={`${prod.brand}-${i}`}
                        style={{
                          position: "relative",
                          display: "flex", gap: 9, alignItems: "center",
                          padding: "8px 10px 8px 12px",
                          background: "linear-gradient(180deg,#ffffff,#fbf9f6)",
                          border: "1px solid var(--border,#e7e2dd)",
                          borderRadius: 10,
                          fontSize: 10,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 1px 2px rgba(17,17,17,.03)",
                          overflow: "hidden",
                        }}
                      >
                        <span style={{
                          position: "absolute", left: 0, top: 6, bottom: 6, width: 3,
                          background: `linear-gradient(180deg,${brandColor},${brandColor}88)`,
                          borderRadius: "0 3px 3px 0",
                        }}/>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: `linear-gradient(180deg,${brandColor},${brandColor}cc)`,
                          border: `1px solid ${brandColor}`,
                          boxShadow: `0 2px 5px ${brandColor}44, inset 0 1px 0 rgba(255,255,255,.25)`,
                        }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 800, color: "var(--t1,#0f1115)", fontSize: 11,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            letterSpacing: "-.005em",
                          }}>
                            {prod.brand}
                          </div>
                          <div style={{
                            color: "var(--t3,#6b7280)", fontSize: 9.5, marginTop: 1,
                            fontVariantNumeric: "tabular-nums", fontWeight: 600,
                          }}>
                            {prod.qty} {prod.unit}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Footer total ── */}
            <div style={{
              marginTop: 8, padding: "10px 12px",
              background: `linear-gradient(180deg,${accent}0a,transparent)`,
              border: "1px solid var(--border,#e7e2dd)",
              borderRadius: 10,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 8.5, color: "var(--t3,#6b7280)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Total</div>
                <div style={{
                  color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 15,
                  fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em", lineHeight: 1.1,
                }}>
                  {render.totalItems}<span style={{ fontSize: 10, color: "var(--t3,#6b7280)", fontWeight: 600 }}> uds</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: "flex", justifyContent: "flex-end",
                  fontSize: 11, color: accent, fontWeight: 900,
                  marginBottom: 4, fontVariantNumeric: "tabular-nums",
                }}>
                  {render.occupancy}%
                </div>
                <div style={{
                  height: 6, borderRadius: 999,
                  background: "linear-gradient(180deg,#ece4d8,#f3eee5)",
                  border: "1px solid var(--border2,#efeae3)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.min(100, render.occupancy)}%`,
                    height: "100%",
                    background: `linear-gradient(90deg,${accent}aa 0%,${accent} 100%)`,
                    borderRadius: 999,
                    boxShadow: `0 0 8px ${accent}66, inset 0 1px 0 rgba(255,255,255,.3)`,
                    transition: "width .5s",
                  }}/>
                </div>
              </div>
            </div>
          </div>
        </aside>
      );
    } else {
      // ── Detalle de entrega ───────────────────────────────────
      const stop = sortedStops.find((s) => s.stopId === selectedItem);
      const stopData = stopsById.get(selectedItem);
      const order = ordersByStop.get(selectedItem);
      const isDone = deliveredStopIds.has(selectedItem);

      if (!stop || !stopData) return null;

      const totalItems = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
      const totalReturn = order?.items.filter(i => i.returnable).reduce((s, i) => s + i.quantity, 0) ?? 0;
      const cashAmount = (order as any)?.collectionAmount ?? 0;
      const paymentType = (order as any)?.paymentType ?? null;

      return (
        <aside className={styles.palletDetailColumn} aria-label="Detalle de entrega">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", position: "relative" }}>

            {/* Botón cerrar */}
            <button onClick={() => onItemSelect(null)} style={closeBtnStyle} aria-label="Cerrar">
              {IcoX}
            </button>

            {/* ── Hero parada ── */}
            <div style={{
              position: "relative",
              padding: "16px 14px 14px 14px",
              marginRight: 38,
              marginBottom: 10,
              background: isDone
                ? "linear-gradient(180deg,rgba(22,163,74,.07) 0%,transparent 100%)"
                : "linear-gradient(180deg,rgba(225,6,0,.06) 0%,transparent 100%)",
              borderRadius: 12,
              border: `1px solid ${isDone ? "rgba(22,163,74,.25)" : "rgba(225,6,0,.22)"}`,
              overflow: "hidden",
            }}>
              <span style={{
                position: "absolute", left: 14, right: 14, top: 0, height: 1,
                background: "linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)",
              }}/>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: isDone
                    ? "linear-gradient(180deg,#22c55e 0%,#15803d 100%)"
                    : "linear-gradient(180deg,#ff3a28 0%,#e10600 50%,#b00500 100%)",
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 13.5, letterSpacing: "-.01em",
                  fontVariantNumeric: "tabular-nums",
                  border: `1px solid ${isDone ? "rgba(22,163,74,.55)" : "rgba(245,200,66,.45)"}`,
                  boxShadow: isDone
                    ? "0 6px 14px rgba(22,163,74,.32), inset 0 1px 0 rgba(255,255,255,.28)"
                    : "0 6px 14px rgba(225,6,0,.36), inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 4px rgba(122,5,0,.4)",
                  textShadow: "0 1px 1px rgba(0,0,0,.2)",
                }}>
                  {isDone ? IcoCheckSm : String(stop.sequence).padStart(2, "0")}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 9, color: isDone ? "var(--ok,#16a34a)" : "var(--red,#e10600)",
                    fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 1,
                  }}>
                    Parada · {String(stop.sequence).padStart(2, "0")}
                  </div>
                  <div style={{
                    color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 14,
                    letterSpacing: "-.01em", lineHeight: 1.15,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {stop.clientName ?? stopData.clientName}
                  </div>
                </div>
              </div>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 6,
                color: "var(--t2,#4b5563)", fontSize: 10, fontWeight: 600, lineHeight: 1.35,
              }}>
                <span style={{ color: "var(--red,#e10600)", lineHeight: 0, marginTop: 2, flexShrink: 0 }}>{IcoPin}</span>
                <span>{stopData.address || stopData.zone}</span>
              </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              <div style={statBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--t3,#6b7280)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  <span style={{ color: "var(--red,#e10600)", lineHeight: 0 }}>{IcoClockSm}</span>
                  ETA
                </div>
                <div style={{
                  color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 16, marginTop: 3,
                  fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em",
                }}>
                  {stop.arrivalEta || "—"}
                </div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--t3,#6b7280)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  <span style={{ color: isDone ? "var(--ok,#16a34a)" : "var(--red,#e10600)", lineHeight: 0 }}>
                    {isDone ? IcoCheckSm : IcoBox}
                  </span>
                  Estado
                </div>
                <div style={{
                  color: isDone ? "var(--ok,#16a34a)" : "var(--t1,#0f1115)",
                  fontWeight: 900, fontSize: 13, marginTop: 4, letterSpacing: "-.005em",
                }}>
                  {isDone ? "Entregado" : "Pendiente"}
                </div>
              </div>
            </div>

            {/* ── Chips de info extra ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 11 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 9px", borderRadius: 999,
                background: "linear-gradient(180deg,rgba(225,6,0,.08),rgba(225,6,0,.03))",
                border: "1px solid rgba(225,6,0,.22)",
                color: "var(--red,#e10600)", fontSize: 9.5, fontWeight: 800,
                letterSpacing: ".04em",
              }}>
                <span style={{ lineHeight: 0 }}>{IcoBox}</span>
                {totalItems} uds
              </span>
              {totalReturn > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 9px", borderRadius: 999,
                  background: "linear-gradient(180deg,rgba(245,200,66,.16),rgba(245,200,66,.06))",
                  border: "1px solid rgba(201,160,32,.4)",
                  color: "#9a7800", fontSize: 9.5, fontWeight: 800,
                  letterSpacing: ".04em",
                }}>
                  <span style={{ lineHeight: 0 }}>{IcoWeight}</span>
                  {totalReturn} retorn.
                </span>
              )}
              {paymentType && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 9px", borderRadius: 999,
                  background: paymentType === "CONTADO"
                    ? "linear-gradient(180deg,rgba(22,163,74,.12),rgba(22,163,74,.04))"
                    : "linear-gradient(180deg,rgba(75,85,99,.08),rgba(75,85,99,.03))",
                  border: paymentType === "CONTADO" ? "1px solid rgba(22,163,74,.32)" : "1px solid var(--border,#e7e2dd)",
                  color: paymentType === "CONTADO" ? "var(--ok,#16a34a)" : "var(--t2,#4b5563)",
                  fontSize: 9.5, fontWeight: 800, letterSpacing: ".04em",
                }}>
                  <span style={{ lineHeight: 0 }}>{IcoCash}</span>
                  {paymentType}
                  {cashAmount > 0 && ` · ${cashAmount.toLocaleString("es-ES")} €`}
                </span>
              )}
            </div>

            {/* ── Items ── */}
            {order && (
              <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingRight: 2 }}>
                <div style={{
                  color: "var(--t3,#6b7280)", fontSize: 9, fontWeight: 800,
                  marginBottom: 6, textTransform: "uppercase", letterSpacing: ".1em",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,var(--border,#e7e2dd))" }}/>
                  {isDone ? "Entregado" : "A descargar"}
                  <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,var(--border,#e7e2dd),transparent)" }}/>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  {order.items.map((it) => {
                    const palette = paletteFor(it.productId, it.name);
                    const isReturnable = it.returnable;
                    return (
                      <li key={it.productId} style={{
                        position: "relative",
                        display: "flex", gap: 9, alignItems: "center",
                        padding: "9px 11px 9px 12px",
                        background: "linear-gradient(180deg,#ffffff,#fbf9f6)",
                        border: "1px solid var(--border,#e7e2dd)",
                        borderRadius: 11,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 1px 2px rgba(17,17,17,.03)",
                        overflow: "hidden",
                      }}>
                        <span style={{
                          position: "absolute", left: 0, top: 6, bottom: 6, width: 3,
                          background: `linear-gradient(180deg,${palette.swatch},${palette.swatch}88)`,
                          borderRadius: "0 3px 3px 0",
                        }}/>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                          background: `linear-gradient(180deg,${palette.swatch},${palette.swatch}cc)`,
                          border: `1px solid ${palette.swatch}`,
                          boxShadow: `0 2px 6px ${palette.swatch}55, inset 0 1px 0 rgba(255,255,255,.25)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", lineHeight: 0,
                        }}>
                          {IcoBox}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                            <span style={{
                              color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 13,
                              fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em",
                            }}>
                              {it.quantity}
                            </span>
                            <span style={{
                              color: "var(--t2,#4b5563)", fontSize: 9.5, fontWeight: 700,
                              textTransform: "uppercase", letterSpacing: ".05em",
                            }}>
                              {it.unit.toLowerCase()}
                            </span>
                            {isReturnable && (
                              <span style={{
                                marginLeft: "auto",
                                fontSize: 8, fontWeight: 800, letterSpacing: ".06em",
                                padding: "1px 5px", borderRadius: 4,
                                background: "linear-gradient(180deg,#f5c842,#d4a100)",
                                color: "#0f1115", textTransform: "uppercase",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)",
                              }}>
                                RET
                              </span>
                            )}
                          </div>
                          <div style={{
                            color: "var(--t3,#6b7280)", fontSize: 10, fontWeight: 600,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {it.name.replace(/\s+RET\.?\s*PP$/i, "").trim()}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* ── Footer total ── */}
            {order && (
              <div style={{
                marginTop: 8, padding: "10px 12px",
                background: isDone
                  ? "linear-gradient(180deg,rgba(22,163,74,.05),transparent)"
                  : "linear-gradient(180deg,rgba(225,6,0,.04),transparent)",
                border: "1px solid var(--border,#e7e2dd)",
                borderRadius: 10,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexShrink: 0,
              }}>
                <div>
                  <div style={{ fontSize: 8.5, color: "var(--t3,#6b7280)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Total parada
                  </div>
                  <div style={{
                    color: "var(--t1,#0f1115)", fontWeight: 900, fontSize: 15,
                    fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em", lineHeight: 1.1,
                  }}>
                    {totalItems}<span style={{ fontSize: 10, color: "var(--t3,#6b7280)", fontWeight: 600 }}> uds</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8.5, color: "var(--t3,#6b7280)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Referencias
                  </div>
                  <div style={{
                    color: "var(--red,#e10600)", fontWeight: 900, fontSize: 15,
                    fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em", lineHeight: 1.1,
                  }}>
                    {order.items.length}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      );
    }
  }

  // ── SVG icons (Heroicons / Lucide outline) ──────────────────
  const IcoTruck = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6"  width="13" height="11" rx="1.5"/>
      <path d="M14 9h4l3 4v4h-7z"/>
      <circle cx="6"  cy="18" r="2"/>
      <circle cx="17" cy="18" r="2"/>
    </svg>
  );
  const IcoPallet = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2"  y="14" width="20" height="4" rx="1"/>
      <rect x="5"  y="10" width="14" height="4" rx="1"/>
      <rect x="8"  y="6"  width="8"  height="4" rx="1"/>
    </svg>
  );
  const IcoCheck = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  const IcoClock = (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  const IcoChevron = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18"/>
    </svg>
  );

  // Tab button styling
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "9px 10px",
    border: "1px solid",
    borderColor: active ? "rgba(225,6,0,.55)" : "var(--border,#e7e2dd)",
    background: active
      ? "linear-gradient(180deg,rgba(225,6,0,.1) 0%,rgba(225,6,0,.04) 100%)"
      : "linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
    color: active ? "var(--red,#e10600)" : "var(--t2,#4b5563)",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    boxShadow: active
      ? "0 0 0 1px rgba(245,200,66,.32), inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px rgba(225,6,0,.08)"
      : "inset 0 1px 0 rgba(255,255,255,.5)",
    transition: "all .18s ease",
  });

  // Lista de palets o entregas
  return (
    <aside className={styles.palletDetailColumn} aria-label="Lista de palets y entregas">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexShrink: 0 }}>
          <button onClick={() => onTabChange("deliveries")} style={tabStyle(tab === "deliveries")}>
            <span style={{ lineHeight: 0 }}>{IcoTruck}</span>
            Entregas
          </button>
          <button onClick={() => onTabChange("palets")} style={tabStyle(tab === "palets")}>
            <span style={{ lineHeight: 0 }}>{IcoPallet}</span>
            Palets
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", minHeight: 0, width: "100%", paddingRight: 2 }}>
          {tab === "palets" ? (
            // ─── PALETS ─────────────────────────────────────────
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              {loadPlan.palletSlots.slice(0, 8).map((slot) => {
                const stack = stacks.get(slot.slotId);
                const isReturn = slot.accessPriority === "returnables";
                const category = stack?.category ?? (isReturn ? "Retornables" : "Vacío");
                const color = ACCENT_BY_TYPE[category] ?? "#94A3B8";
                const totalQty = stack?.totalCount ?? 0;
                const cap = category === "Barriles" ? 20 : 60;
                const fillPct = cap > 0 ? Math.min(100, (totalQty / cap) * 100) : 0;
                const isSelected = selectedItem === slot.slotId;
                const isEmpty = totalQty === 0;

                return (
                  <button
                    key={slot.slotId}
                    onClick={() => onItemSelect(slot.slotId)}
                    style={{
                      position: "relative",
                      width: "100%",
                      padding: "10px 12px 11px 14px",
                      border: `1px solid ${isSelected ? color : "var(--border,#e7e2dd)"}`,
                      background: isSelected
                        ? `linear-gradient(180deg,${color}14 0%,${color}06 100%)`
                        : "linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                      borderRadius: 12,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      textAlign: "left",
                      boxShadow: isSelected
                        ? `0 0 0 1px ${color}33, 0 6px 16px ${color}1f, inset 0 1px 0 rgba(255,255,255,.5)`
                        : "inset 0 1px 0 rgba(255,255,255,.5), 0 1px 2px rgba(17,17,17,.03)",
                      transition: "all .18s ease",
                      overflow: "hidden",
                    }}
                  >
                    {/* Barra lateral de color categoría */}
                    <span style={{
                      position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
                      background: isEmpty ? "transparent" : `linear-gradient(180deg,${color},${color}88)`,
                      borderRadius: "0 3px 3px 0",
                    }}/>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: `linear-gradient(180deg,${color}22,${color}10)`,
                          border: `1px solid ${color}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color, lineHeight: 0,
                        }}>
                          {IcoPallet}
                        </span>
                        <span style={{
                          fontWeight: 900, color, fontSize: 13,
                          letterSpacing: "-.005em", fontVariantNumeric: "tabular-nums",
                        }}>
                          {slot.slotId}
                        </span>
                        <span style={{
                          fontSize: 8.5, color: "var(--t3,#6b7280)",
                          fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
                          padding: "1px 6px", borderRadius: 4,
                          background: "rgba(0,0,0,.03)",
                          border: "1px solid var(--border2,#efeae3)",
                        }}>
                          {category}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11, color: "var(--t1,#0f1115)",
                        fontWeight: 800, fontVariantNumeric: "tabular-nums",
                      }}>
                        {totalQty}<span style={{ color: "var(--t3,#6b7280)", fontWeight: 600 }}>/{cap}</span>
                      </span>
                    </div>

                    {/* Progress bar premium */}
                    <div style={{
                      height: 5, borderRadius: 999,
                      background: "linear-gradient(180deg,#ece4d8,#f3eee5)",
                      border: "1px solid var(--border2,#efeae3)",
                      overflow: "hidden", boxShadow: "inset 0 1px 1px rgba(0,0,0,.04)",
                    }}>
                      <div style={{
                        height: "100%", width: `${fillPct}%`,
                        background: `linear-gradient(90deg,${color}cc 0%,${color} 100%)`,
                        borderRadius: 999,
                        boxShadow: `0 0 8px ${color}55, inset 0 1px 0 rgba(255,255,255,.3)`,
                        transition: "width .5s cubic-bezier(.4,0,.2,1)",
                      }}/>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // ─── ENTREGAS ───────────────────────────────────────
            <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
              {sortedStops.map((rs) => {
                const isDone = deliveredStopIds.has(rs.stopId);
                const isSelected = selectedItem === rs.stopId;
                const stopData = stopsById.get(rs.stopId);

                const accent = isDone
                  ? "var(--ok,#16a34a)"
                  : isSelected
                  ? "var(--red,#e10600)"
                  : "transparent";

                return (
                  <button
                    key={rs.stopId}
                    onClick={() => onItemSelect(rs.stopId)}
                    style={{
                      position: "relative",
                      width: "100%",
                      padding: "10px 12px 10px 14px",
                      border: `1px solid ${
                        isSelected ? "rgba(225,6,0,.55)"
                        : isDone ? "rgba(22,163,74,.32)"
                        : "var(--border,#e7e2dd)"
                      }`,
                      background: isSelected
                        ? "linear-gradient(180deg,rgba(225,6,0,.08) 0%,rgba(225,6,0,.03) 100%)"
                        : isDone
                        ? "linear-gradient(180deg,rgba(22,163,74,.05) 0%,rgba(22,163,74,.02) 100%)"
                        : "linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                      borderRadius: 11,
                      cursor: "pointer",
                      textAlign: "left",
                      opacity: isDone && !isSelected ? 0.72 : 1,
                      boxSizing: "border-box",
                      boxShadow: isSelected
                        ? "0 0 0 1px rgba(245,200,66,.3), 0 6px 14px rgba(225,6,0,.1), inset 0 1px 0 rgba(255,255,255,.5)"
                        : "inset 0 1px 0 rgba(255,255,255,.5), 0 1px 2px rgba(17,17,17,.03)",
                      transition: "all .18s ease",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {/* Barra lateral acento */}
                    <span style={{
                      position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
                      background: accent,
                      borderRadius: "0 3px 3px 0",
                    }}/>

                    {/* Círculo de secuencia / estado */}
                    <span style={{
                      width: 30, height: 30, borderRadius: "50%",
                      flexShrink: 0,
                      background: isDone
                        ? "linear-gradient(180deg,#22c55e 0%,#15803d 100%)"
                        : isSelected
                        ? "linear-gradient(180deg,#ff3a28 0%,#e10600 50%,#b00500 100%)"
                        : "linear-gradient(180deg,#ffffff,#f3eee5)",
                      color: isDone || isSelected ? "#fff" : "var(--t1,#0f1115)",
                      border: `1px solid ${
                        isDone ? "rgba(22,163,74,.5)"
                        : isSelected ? "rgba(245,200,66,.45)"
                        : "var(--border,#e7e2dd)"
                      }`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: 11.5,
                      fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em",
                      boxShadow: isDone
                        ? "0 4px 10px rgba(22,163,74,.3), inset 0 1px 0 rgba(255,255,255,.3)"
                        : isSelected
                        ? "0 4px 10px rgba(225,6,0,.32), inset 0 1px 0 rgba(255,255,255,.3), inset 0 -2px 4px rgba(122,5,0,.4)"
                        : "inset 0 1px 0 rgba(255,255,255,.6)",
                      textShadow: (isDone || isSelected) ? "0 1px 1px rgba(0,0,0,.2)" : "none",
                    }}>
                      {isDone ? IcoCheck : String(rs.sequence).padStart(2, "0")}
                    </span>

                    {/* Cuerpo */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: "var(--t1,#0f1115)",
                        fontWeight: 800, fontSize: 11.5,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        letterSpacing: "-.005em",
                      }}>
                        {rs.clientName ?? stopData?.clientName ?? "—"}
                      </div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 4,
                        marginTop: 2,
                        color: isDone ? "var(--ok,#16a34a)" : "var(--t3,#6b7280)",
                        fontSize: 9.5, fontWeight: 700,
                        letterSpacing: ".04em",
                      }}>
                        <span style={{ lineHeight: 0 }}>{IcoClock}</span>
                        {rs.arrivalEta || "—"}
                        {isDone && (
                          <span style={{
                            marginLeft: 4,
                            fontSize: 8.5, fontWeight: 800,
                            textTransform: "uppercase", letterSpacing: ".08em",
                          }}>
                            · Entregada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    {!isDone && (
                      <span style={{
                        color: isSelected ? "var(--red,#e10600)" : "var(--t3,#6b7280)",
                        opacity: isSelected ? 1 : .4,
                        lineHeight: 0,
                      }}>
                        {IcoChevron}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
