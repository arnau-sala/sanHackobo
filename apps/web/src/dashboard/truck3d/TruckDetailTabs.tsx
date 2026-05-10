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
      return (
        <aside className={styles.palletDetailColumn} aria-label="Detalle del palet">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
            <button
              onClick={() => onItemSelect(null)}
              style={{
                alignSelf: "flex-end",
                padding: "6px 10px",
                border: "1px solid var(--border)",
                background: "var(--bg4)",
                color: "var(--t2)",
                borderRadius: 6,
                cursor: "pointer",
                marginBottom: 10,
                fontSize: 11,
              }}
            >
              ✕ Cerrar
            </button>

            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>
              Palet {slot.slotId}
            </h4>
            <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: "var(--t1)" }}>
              {render.typeLabel}
            </h3>
            <p style={{ margin: "0 0 8px", fontSize: 10, color: "var(--t2)" }}>
              {render.sideStr} · {render.stops}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
              <div style={{ background: "var(--bg4)", padding: "6px 8px", borderRadius: 6, fontSize: 9 }}>
                <span style={{ color: "var(--t3)" }}>Categoría</span>
                <div style={{ color: "var(--t1)", fontWeight: 700 }}>{stack.category}</div>
              </div>
              <div style={{ background: "var(--bg4)", padding: "6px 8px", borderRadius: 6, fontSize: 9 }}>
                <span style={{ color: "var(--t3)" }}>Ocupación</span>
                <div style={{ color: render.accentColor, fontWeight: 700 }}>{render.occupancy}%</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[col0Brand, col1Brand].map((b, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: `${b.top}12`,
                    border: `1px solid ${b.top}30`,
                    borderRadius: 6,
                    padding: "6px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ width: 10, height: 10, background: b.top, borderRadius: 3, margin: "0 auto 3px" }} />
                  <div style={{ fontSize: 8, color: "var(--t2)", fontWeight: 700, lineHeight: 1 }}>
                    {b.abbr}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              <div style={{ color: "var(--t3)", fontSize: 9, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                Productos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {render.products.length === 0 ? (
                  <div style={{ fontSize: 10, color: "var(--t3)", fontStyle: "italic" }}>
                    {render.typeLabel === "Retornables" ? "Espacio para envases retornables" : "Palet vacio"}
                  </div>
                ) : (
                  render.products.map((prod, i) => (
                    <div
                      key={`${prod.brand}-${i}`}
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: "6px 8px",
                        background: "var(--bg4)",
                        borderRadius: 6,
                        fontSize: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 3,
                          background: BRANDS[render.cols[Math.min(i, 1)].brandKey].top,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--t1)" }}>
                          {prod.brand}
                        </div>
                        <div style={{ color: "var(--t3)", fontSize: 9 }}>
                          {prod.qty} {prod.unit}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "var(--t2)" }}>Total: {render.totalItems}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 9, color: render.accentColor, fontWeight: 700 }}>
                  {render.occupancy}%
                </span>
                <div style={{ width: 38, height: 4, background: "var(--bg4)", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, render.occupancy)}%`,
                      height: "100%",
                      background: render.accentColor,
                      borderRadius: 2,
                      transition: "width 280ms",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      );
    } else {
      // Mostrar detalles de entrega
      const stop = sortedStops.find((s) => s.stopId === selectedItem);
      const stopData = stopsById.get(selectedItem);
      const order = ordersByStop.get(selectedItem);
      const isDone = deliveredStopIds.has(selectedItem);

      if (!stop || !stopData) return null;

      return (
        <aside className={styles.palletDetailColumn} aria-label="Detalle de entrega">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
            <button
              onClick={() => onItemSelect(null)}
              style={{
                alignSelf: "flex-end",
                padding: "6px 10px",
                border: "1px solid var(--border)",
                background: "var(--bg4)",
                color: "var(--t2)",
                borderRadius: 6,
                cursor: "pointer",
                marginBottom: 10,
                fontSize: 11,
              }}
            >
              ✕ Cerrar
            </button>

            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>
              Parada #{String(stop.sequence).padStart(2, "0")}
            </h4>
            <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: "var(--t1)" }}>
              {stop.clientName ?? stopData.clientName}
            </h3>
            <p style={{ margin: "0 0 8px", fontSize: 10, color: "var(--t2)" }}>
              📍 {stopData.address || stopData.zone}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
              <div style={{ background: "var(--bg4)", padding: "6px 8px", borderRadius: 6, fontSize: 9 }}>
                <span style={{ color: "var(--t3)" }}>ETA</span>
                <div style={{ color: "var(--t1)", fontWeight: 700 }}>{stop.arrivalEta || "-"}</div>
              </div>
              <div style={{ background: "var(--bg4)", padding: "6px 8px", borderRadius: 6, fontSize: 9 }}>
                <span style={{ color: "var(--t3)" }}>Estado</span>
                <div style={{ color: isDone ? "#22c55e" : "var(--t1)", fontWeight: 700 }}>
                  {isDone ? "✓ Entregado" : "Pendiente"}
                </div>
              </div>
            </div>

            {order && !isDone && (
              <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                <div style={{ color: "var(--t3)", fontSize: 9, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                  Items a recoger
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {order.items.map((it) => {
                    const palette = paletteFor(it.productId, it.name);
                    return (
                      <li
                        key={it.productId}
                        style={{
                          display: "flex",
                          gap: 8,
                          padding: "6px 8px",
                          background: "var(--bg4)",
                          borderRadius: 6,
                          fontSize: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            background: palette.swatch,
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--t1)" }}>
                            {it.quantity} {it.unit.toLowerCase()}
                          </div>
                          <div style={{ color: "var(--t3)", fontSize: 9 }}>
                            {it.name.replace(/\s+RET\.?\s*PP$/i, "")}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </aside>
      );
    }
  }

  // Lista de palets o entregas
  return (
    <aside className={styles.palletDetailColumn} aria-label="Lista de palets y entregas">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexShrink: 0 }}>
          <button
            onClick={() => onTabChange("palets")}
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "1px solid",
              borderColor: tab === "palets" ? "var(--red)" : "var(--border)",
              background: tab === "palets" ? "rgba(225,6,0,.1)" : "var(--bg4)",
              color: tab === "palets" ? "var(--red)" : "var(--t2)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            📦 Palets
          </button>
          <button
            onClick={() => onTabChange("deliveries")}
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "1px solid",
              borderColor: tab === "deliveries" ? "var(--red)" : "var(--border)",
              background: tab === "deliveries" ? "rgba(225,6,0,.1)" : "var(--bg4)",
              color: tab === "deliveries" ? "var(--red)" : "var(--t2)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            🚚 Entregas
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", minHeight: 0, width: "100%" }}>
          {tab === "palets" ? (
            // Lista de palets
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

                return (
                  <button
                    key={slot.slotId}
                    onClick={() => onItemSelect(slot.slotId)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: `1px solid ${isSelected ? color : "var(--border)"}`,
                      background: isSelected ? `${color}11` : "var(--bg4)",
                      borderRadius: 6,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: color, fontSize: 12 }}>
                        {slot.slotId}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--t2)" }}>
                        {totalQty}/{cap}
                      </span>
                    </div>
                    <div style={{ height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${fillPct}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 9, color: "var(--t3)" }}>
                      {category}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // Lista de entregas
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              {sortedStops.map((rs) => {
                const isDone = deliveredStopIds.has(rs.stopId);
                const isSelected = selectedItem === rs.stopId;
                const stopData = stopsById.get(rs.stopId);

                return (
                  <button
                    key={rs.stopId}
                    onClick={() => onItemSelect(rs.stopId)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: `1px solid ${isSelected ? "var(--red)" : isDone ? "var(--ok)" : "var(--border)"}`,
                      background: isSelected
                        ? "rgba(225,6,0,.1)"
                        : isDone
                          ? "rgba(34,197,94,.05)"
                          : "var(--bg4)",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "left",
                      opacity: isDone && !isSelected ? 0.6 : 1,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 11 }}>
                        Parada #{String(rs.sequence).padStart(2, "0")}
                      </span>
                      {isDone && <span style={{ color: "var(--ok)", fontSize: 9, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t2)", fontWeight: 600, marginBottom: 2 }}>
                      {rs.clientName ?? stopData?.clientName}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--t3)" }}>
                      {rs.arrivalEta || "-"}
                    </div>
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
