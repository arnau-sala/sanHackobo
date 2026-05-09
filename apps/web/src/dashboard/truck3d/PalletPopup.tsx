/**
 * Popup flotante con el detalle del palet seleccionado.
 *
 * Port directo del export del Figma: vive DENTRO del `<svg>` como un
 * `<foreignObject>` anclado al palet. Asi cuando el SVG se escala,
 * el popup se mantiene siempre pegado al palet correspondiente sin
 * tener que sincronizar coordenadas DOM ↔ SVG.
 *
 * Muestra:
 *   - chip con id (P1..P8) en color de acento + categoria + lateral
 *   - resumen de marcas presentes en sus 2 columnas
 *   - lista breve de productos (nombre + cantidad + unidad)
 *   - footer con total y barra de ocupacion
 */
import type { PalletSlot } from "@damm/optimizer-load";
import { iso } from "./projection";
import { BRANDS } from "./figmaBrands";
import type { RenderPallet } from "./palletRenderModel";
import type { PalletStackInfo } from "./buildPalletStack";

const Z1 = 1.42;
const POP_W = 196;
const POP_H = 178;
const VIEWBOX_W = 680;
const VIEWBOX_H = 400;

export type PalletPopupProps = {
  slot: PalletSlot;
  stack: PalletStackInfo;
  render: RenderPallet;
  bbox: { x0: number; x1: number; y0: number; y1: number };
  onClose: () => void;
};

export function PalletPopup({
  render,
  bbox,
  onClose,
}: PalletPopupProps) {
  // Anclar a la cara mas cercana al borde (izquierdo o derecho del
  // trailer) para evitar que el popup se solape con la cabina.
  const isLeftSide = (bbox.x0 + bbox.x1) / 2 < 4;
  const [anchorX, anchorY] = isLeftSide
    ? iso(bbox.x1, (bbox.y0 + bbox.y1) / 2, Z1)
    : iso(bbox.x0, (bbox.y0 + bbox.y1) / 2, Z1);

  const rawX = isLeftSide ? anchorX + 10 : anchorX - POP_W - 10;
  const rawY = anchorY - POP_H / 2;
  const fx = Math.max(4, Math.min(VIEWBOX_W - POP_W - 4, rawX));
  const fy = Math.max(4, Math.min(VIEWBOX_H - POP_H - 4, rawY));

  const col0Brand = BRANDS[render.cols[0].brandKey];
  const col1Brand = BRANDS[render.cols[1].brandKey];

  return (
    <foreignObject
      x={fx}
      y={fy}
      width={POP_W}
      height={POP_H}
      style={{ overflow: "visible" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: `1.5px solid ${render.accentColor}55`,
          borderRadius: 10,
          padding: "10px 12px",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#111827",
          boxShadow: `0 8px 28px rgba(0,0,0,0.15), 0 0 0 1px ${render.accentColor}22`,
          width: POP_W,
          height: POP_H,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 9,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 26,
                height: 26,
                background: render.accentColor,
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 900,
                color: "#FFFFFF",
                flexShrink: 0,
              }}
            >
              {render.slotId}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.2,
                }}
              >
                {render.typeLabel}
              </div>
              <div style={{ fontSize: 9, color: "#4B5563" }}>
                {render.sideStr} · {render.stops}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: "#F3F4F6",
              border: "1px solid #E5E7EB",
              color: "#6B7280",
              cursor: "pointer",
              width: 20,
              height: 20,
              borderRadius: 5,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Indicadores de marca */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {[col0Brand, col1Brand].map((b, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: `${b.top}18`,
                border: `1px solid ${b.top}40`,
                borderRadius: 6,
                padding: "4px 6px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: b.top,
                  borderRadius: 3,
                  margin: "0 auto 3px",
                }}
              />
              <div
                style={{
                  fontSize: 8,
                  color: "#374151",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {b.abbr}
              </div>
            </div>
          ))}
        </div>

        {/* Productos */}
        <div style={{ marginBottom: 8 }}>
          {render.products.length === 0 && (
            <div style={{ fontSize: 10, color: "#6B7280", fontStyle: "italic" }}>
              {render.typeLabel === "Retornables"
                ? "Espacio para envases retornables"
                : "Palet vacio"}
            </div>
          )}
          {render.products.map((prod, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 5,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: BRANDS[render.cols[Math.min(i, 1)].brandKey].top,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#111827",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {prod.brand}
                </div>
                <div style={{ fontSize: 8.5, color: "#4B5563" }}>
                  {prod.qty} {prod.unit}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #E5E7EB",
            paddingTop: 7,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 9, color: "#4B5563" }}>
            Total: {render.totalItems}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontSize: 9,
                color: render.accentColor,
                fontWeight: 700,
              }}
            >
              {render.occupancy}%
            </span>
            <div
              style={{
                width: 38,
                height: 4,
                background: "#F3F4F6",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
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
    </foreignObject>
  );
}
