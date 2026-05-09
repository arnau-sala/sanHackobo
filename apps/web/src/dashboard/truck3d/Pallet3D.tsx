/**
 * Palet 3D = base de madera + 2 franjas de carga (cajas o barriles).
 *
 * Layout logistico en **eje Y** (profundidad del trailer: cabina → trasera):
 * cada mitad del palet ocupa todo el ancho (X), asi las dos familias de
 * producto quedan una delante de otra y **ambas son alcanzables desde el
 * lateral** al abrir la lona (no hay una “columna interior” oculta tras la
 * otra en ancho).
 *
 * `cols[0]` = franja hacia la pared delantera del trailer (y bajo);
 * `cols[1]` = franja hacia la trasera (y alto).
 *
 * Estados visuales:
 *   - `dimmed`   : fuera del foco (modo "Proxima parada", el resto se
 *     atenua para que el palet activo destaque).
 *   - `highlighted`: este palet contiene la entrega activa → halo amber
 *     + label resaltado.
 *   - `selected`: el usuario lo ha pinchado → outline azul.
 */
import React from "react";
import { iso, pts } from "./projection";
import { BRANDS, type BrandKey, type Brand } from "./figmaBrands";
import type { RenderColumn, RenderPallet } from "./palletRenderModel";

const BASE_H = 0.3; // altura de la base de madera
const Z1 = 1.42; // altura total palet + carga
const LAYER_H = (Z1 - BASE_H) / 2; // altura de cada capa de cajas

export type Pallet3DProps = {
  pallet: RenderPallet;
  bbox: { x0: number; x1: number; y0: number; y1: number };
  highlighted?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  onSelect?: (slotId: string) => void;
};

// ── Wooden base ──────────────────────────────────────────────────────
function WoodenBase({
  x0,
  x1,
  y0,
  y1,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}) {
  const plankYs: number[] = [];
  for (let yl = y0 + 0.28; yl < y1 - 0.05; yl += 0.28) plankYs.push(yl);

  return (
    <>
      {/* Cara derecha */}
      <polygon
        points={pts([
          iso(x1, y0, 0),
          iso(x1, y1, 0),
          iso(x1, y1, BASE_H),
          iso(x1, y0, BASE_H),
        ])}
        fill="#5C3A10"
      />
      {[BASE_H * 0.35, BASE_H * 0.68].map((sz, i) => (
        <line
          key={`rs${i}`}
          x1={iso(x1, y0, sz)[0]}
          y1={iso(x1, y0, sz)[1]}
          x2={iso(x1, y1, sz)[0]}
          y2={iso(x1, y1, sz)[1]}
          stroke="#3A2208"
          strokeWidth="0.8"
        />
      ))}

      {/* Cara frontal */}
      <polygon
        points={pts([
          iso(x0, y0, 0),
          iso(x1, y0, 0),
          iso(x1, y0, BASE_H),
          iso(x0, y0, BASE_H),
        ])}
        fill="#6E4618"
      />
      {[BASE_H * 0.35, BASE_H * 0.68].map((sz, i) => (
        <line
          key={`fs${i}`}
          x1={iso(x0, y0, sz)[0]}
          y1={iso(x0, y0, sz)[1]}
          x2={iso(x1, y0, sz)[0]}
          y2={iso(x1, y0, sz)[1]}
          stroke="#4A3010"
          strokeWidth="0.8"
        />
      ))}
      {[x0 + (x1 - x0) * 0.33, x0 + (x1 - x0) * 0.66].map((xv, i) => (
        <line
          key={`fv${i}`}
          x1={iso(xv, y0, 0)[0]}
          y1={iso(xv, y0, 0)[1]}
          x2={iso(xv, y0, BASE_H)[0]}
          y2={iso(xv, y0, BASE_H)[1]}
          stroke="#4A3010"
          strokeWidth="0.9"
        />
      ))}

      {/* Cara superior (deck) */}
      <polygon
        points={pts([
          iso(x0, y0, BASE_H),
          iso(x1, y0, BASE_H),
          iso(x1, y1, BASE_H),
          iso(x0, y1, BASE_H),
        ])}
        fill="#7A5020"
      />
      {plankYs.map((yl, i) => (
        <line
          key={`pl${i}`}
          x1={iso(x0 + 0.04, yl, BASE_H)[0]}
          y1={iso(x0 + 0.04, yl, BASE_H)[1]}
          x2={iso(x1 - 0.04, yl, BASE_H)[0]}
          y2={iso(x1 - 0.04, yl, BASE_H)[1]}
          stroke="#5A3C14"
          strokeWidth="0.7"
        />
      ))}
      <line
        x1={iso((x0 + x1) / 2, y0 + 0.04, BASE_H)[0]}
        y1={iso((x0 + x1) / 2, y0 + 0.04, BASE_H)[1]}
        x2={iso((x0 + x1) / 2, y1 - 0.04, BASE_H)[0]}
        y2={iso((x0 + x1) / 2, y1 - 0.04, BASE_H)[1]}
        stroke="#5A3C14"
        strokeWidth="0.5"
      />
    </>
  );
}

// ── Cargo column: pila de cajas ──────────────────────────────────────
function BoxStack({
  x0,
  x1,
  y0,
  y1,
  zBase,
  layers,
  brand,
  brandKey,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  zBase: number;
  /** numero de capas a renderizar (0/1/2). */
  layers: 0 | 1 | 2;
  brand: Brand;
  brandKey: BrandKey;
}) {
  if (layers === 0) return null;
  const xMid = (x0 + x1) / 2;

  return (
    <>
      {Array.from({ length: layers }, (_, i) => {
        const lz0 = zBase + i * LAYER_H + (i > 0 ? 0.025 : 0);
        const lz1 = zBase + (i + 1) * LAYER_H - 0.025;
        const [faceCx, faceCy] = iso(xMid, y0, (lz0 + lz1) / 2);
        return (
          <React.Fragment key={i}>
            {/* Cara derecha */}
            <polygon
              points={pts([
                iso(x1, y0, lz0),
                iso(x1, y1, lz0),
                iso(x1, y1, lz1),
                iso(x1, y0, lz1),
              ])}
              fill={brand.side}
            />
            <line
              x1={iso(x1, (y0 + y1) / 2, lz0)[0]}
              y1={iso(x1, (y0 + y1) / 2, lz0)[1]}
              x2={iso(x1, (y0 + y1) / 2, lz1)[0]}
              y2={iso(x1, (y0 + y1) / 2, lz1)[1]}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="0.5"
            />
            {/* Cara frontal */}
            <polygon
              points={pts([
                iso(x0, y0, lz0),
                iso(x1, y0, lz0),
                iso(x1, y0, lz1),
                iso(x0, y0, lz1),
              ])}
              fill={brand.front}
            />
            <line
              x1={iso(xMid, y0, lz0)[0]}
              y1={iso(xMid, y0, lz0)[1]}
              x2={iso(xMid, y0, lz1)[0]}
              y2={iso(xMid, y0, lz1)[1]}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="0.6"
            />
            {/* Logo / abreviatura */}
            <BrandFrontLabel brandKey={brandKey} cx={faceCx} cy={faceCy} brand={brand} />
            {/* Cara superior */}
            <polygon
              points={pts([
                iso(x0, y0, lz1),
                iso(x1, y0, lz1),
                iso(x1, y1, lz1),
                iso(x0, y1, lz1),
              ])}
              fill={brand.top}
            />
            <line
              x1={iso(xMid, y0 + 0.03, lz1)[0]}
              y1={iso(xMid, y0 + 0.03, lz1)[1]}
              x2={iso(xMid, y1 - 0.03, lz1)[0]}
              y2={iso(xMid, y1 - 0.03, lz1)[1]}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <line
              x1={iso(x0 + 0.03, (y0 + y1) / 2, lz1)[0]}
              y1={iso(x0 + 0.03, (y0 + y1) / 2, lz1)[1]}
              x2={iso(x1 - 0.03, (y0 + y1) / 2, lz1)[0]}
              y2={iso(x1 - 0.03, (y0 + y1) / 2, lz1)[1]}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

function BrandFrontLabel({
  brandKey,
  cx,
  cy,
  brand,
}: {
  brandKey: BrandKey;
  cx: number;
  cy: number;
  brand: Brand;
}) {
  if (brandKey === "estrellaDamm") {
    return (
      <g transform={`translate(${cx}, ${cy}) scale(0.6)`}>
        <polygon
          points="0,-5 1.5,-1.5 5,-1.5 2,0.8 3,4.5 0,2.5 -3,4.5 -2,0.8 -5,-1.5 -1.5,-1.5"
          fill="#FFEB3B"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="0.4"
        />
      </g>
    );
  }
  if (brandKey === "dammLemon") {
    return (
      <g transform={`translate(${cx}, ${cy}) scale(0.6)`}>
        <circle cx="0" cy="0" r="3.5" fill="#FFE100" />
        <circle cx="0" cy="0" r="2.5" fill="#FFF" opacity="0.3" />
      </g>
    );
  }
  if (brandKey === "freeDamm") {
    return (
      <text
        x={cx}
        y={cy + 2.5}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="7"
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
        style={{ userSelect: "none", paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 0.35 }}
      >
        0,0
      </text>
    );
  }
  if (brandKey === "cacaolat") {
    return (
      <g transform={`translate(${cx}, ${cy}) scale(0.6)`}>
        <ellipse cx="0" cy="0" rx="2.5" ry="4" fill="#F0D800" />
        <text
          x="0"
          y="1.5"
          textAnchor="middle"
          fill="#5A2808"
          fontSize="4"
          fontWeight="bold"
        >
          C
        </text>
      </g>
    );
  }
  return (
    <text
      x={cx}
      y={cy + 2.5}
      textAnchor="middle"
      fill="rgba(255,255,255,0.85)"
      fontSize="6.5"
      fontWeight="800"
      fontFamily="system-ui, sans-serif"
      style={{ userSelect: "none", letterSpacing: "0.3px" }}
    >
      {brand.abbr}
    </text>
  );
}

// ── Cargo column: par de barriles ────────────────────────────────────
function BarrelPair({
  x0,
  x1,
  y0,
  y1,
  zBase,
  zTop,
  brand,
  brandKey,
  visible,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  zBase: number;
  zTop: number;
  brand: Brand;
  brandKey: BrandKey;
  /** Si false, no se dibuja (palet vacio). */
  visible: boolean;
}) {
  if (!visible) return null;
  const yMid = (y0 + y1) / 2;
  const slots = [
    { by0: y0 + 0.05, by1: yMid - 0.05 },
    { by0: yMid + 0.05, by1: y1 - 0.05 },
  ];
  const HOOPS = [0.22, 0.5, 0.78];

  return (
    <>
      {slots.map(({ by0, by1 }, si) => {
        const bz0 = zBase;
        const bz1 = zTop;
        const [ocx, ocy] = iso((x0 + x1) / 2, (by0 + by1) / 2, bz1);
        const [ex0] = iso(x0, (by0 + by1) / 2, bz1);
        const [ex1] = iso(x1, (by0 + by1) / 2, bz1);
        const [, ey0] = iso((x0 + x1) / 2, by0, bz1);
        const [, ey1] = iso((x0 + x1) / 2, by1, bz1);
        const rx = Math.abs(ex1 - ex0) * 0.4;
        const ry = Math.abs(ey1 - ey0) * 0.4;
        return (
          <React.Fragment key={si}>
            {/* Cuerpo - cara derecha */}
            <polygon
              points={pts([
                iso(x1, by0, bz0),
                iso(x1, by1, bz0),
                iso(x1, by1, bz1),
                iso(x1, by0, bz1),
              ])}
              fill={brand.side}
            />
            {HOOPS.map((r, hi) => {
              const hz = bz0 + r * (bz1 - bz0);
              const bh = 0.04;
              return (
                <polygon
                  key={hi}
                  points={pts([
                    iso(x1, by0, hz - bh),
                    iso(x1, by1, hz - bh),
                    iso(x1, by1, hz + bh),
                    iso(x1, by0, hz + bh),
                  ])}
                  fill="#B0B0B0"
                  opacity={0.65}
                />
              );
            })}
            {/* Cuerpo - cara frontal */}
            <polygon
              points={pts([
                iso(x0, by0, bz0),
                iso(x1, by0, bz0),
                iso(x1, by0, bz1),
                iso(x0, by0, bz1),
              ])}
              fill={brand.front}
            />
            {HOOPS.map((r, hi) => {
              const hz = bz0 + r * (bz1 - bz0);
              const bh = 0.04;
              return (
                <polygon
                  key={hi}
                  points={pts([
                    iso(x0, by0, hz - bh),
                    iso(x1, by0, hz - bh),
                    iso(x1, by0, hz + bh),
                    iso(x0, by0, hz + bh),
                  ])}
                  fill="#B8B8B8"
                  opacity={0.65}
                />
              );
            })}
            {/* Etiqueta */}
            {(() => {
              const [cx, cy] = iso((x0 + x1) / 2, by0, (bz0 + bz1) / 2);
              if (brandKey === "barrilED30") {
                return (
                  <g transform={`translate(${cx}, ${cy}) scale(0.7)`}>
                    <polygon
                      points="0,-5 1.5,-1.5 5,-1.5 2,0.8 3,4.5 0,2.5 -3,4.5 -2,0.8 -5,-1.5 -1.5,-1.5"
                      fill="#E32636"
                    />
                  </g>
                );
              }
              return (
                <text
                  x={cx}
                  y={cy + 2.5}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.8)"
                  fontSize="6"
                  fontWeight="800"
                  fontFamily="system-ui, sans-serif"
                  style={{ userSelect: "none" }}
                >
                  {brand.abbr}
                </text>
              );
            })()}
            {/* Cara superior */}
            <polygon
              points={pts([
                iso(x0, by0, bz1),
                iso(x1, by0, bz1),
                iso(x1, by1, bz1),
                iso(x0, by1, bz1),
              ])}
              fill={brand.top}
            />
            <ellipse
              cx={ocx}
              cy={ocy}
              rx={rx}
              ry={ry}
              fill={brand.top}
              stroke="#C0C0C0"
              strokeWidth="1.0"
              opacity={0.8}
            />
            <circle cx={ocx} cy={ocy} r={2.2} fill="#1A1A1A" opacity={0.7} />
            <circle cx={ocx} cy={ocy} r={1.1} fill="#888888" />
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Pallet group ─────────────────────────────────────────────────────
export function Pallet3D({
  pallet,
  bbox,
  highlighted,
  dimmed,
  selected,
  onSelect,
}: Pallet3DProps) {
  const { x0, x1, y0, y1 } = bbox;
  const midY = (y0 + y1) / 2;
  const gap = 0.07;
  const bandX0 = x0 + 0.06;
  const bandX1 = x1 - 0.06;
  /** Franja delantera (acceso lateral, hacia cabina). */
  const band1Y0 = y0 + 0.06;
  const band1Y1 = midY - gap / 2;
  /** Franja trasera. */
  const band2Y0 = midY + gap / 2;
  const band2Y1 = y1 - 0.06;
  const opacity = dimmed ? 0.18 : 1;

  const renderBand = (
    col: RenderColumn,
    bx0: number,
    bx1: number,
    by0: number,
    by1: number,
  ) => {
    const brand = BRANDS[col.brandKey];
    if (brand.isBarrel) {
      return (
        <BarrelPair
          x0={bx0}
          x1={bx1}
          y0={by0}
          y1={by1}
          zBase={BASE_H}
          zTop={Z1}
          brand={brand}
          brandKey={col.brandKey}
          visible={col.layers > 0}
        />
      );
    }
    return (
      <BoxStack
        x0={bx0}
        x1={bx1}
        y0={by0}
        y1={by1}
        zBase={BASE_H}
        layers={col.layers}
        brand={brand}
        brandKey={col.brandKey}
      />
    );
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(pallet.slotId);
  };

  const labelZ = Z1 + 0.18;

  return (
    <g
      data-slot={pallet.slotId}
      opacity={opacity}
      onClick={handleClick}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Sombra en suelo */}
      <polygon
        points={pts([
          iso(x0 + 0.1, y0 + 0.1, 0.01),
          iso(x1 - 0.1, y0 + 0.1, 0.01),
          iso(x1 - 0.1, y1 - 0.1, 0.01),
          iso(x0 + 0.1, y1 - 0.1, 0.01),
        ])}
        fill="rgba(0,0,0,0.18)"
      />

      {/* Base de madera */}
      <WoodenBase x0={x0} x1={x1} y0={y0} y1={y1} />

      {/* Carga: dos franjas en Y (ancho completo en X) */}
      {renderBand(pallet.cols[0], bandX0, bandX1, band1Y0, band1Y1)}
      {renderBand(pallet.cols[1], bandX0, bandX1, band2Y0, band2Y1)}

      {/* Linea separadora en la tapa entre franjas delanteras/traseras */}
      {pallet.cols[0].layers > 0 && pallet.cols[1].layers > 0 && (
        <line
          x1={iso(x0 + 0.04, midY, Z1)[0]}
          y1={iso(x0 + 0.04, midY, Z1)[1]}
          x2={iso(x1 - 0.04, midY, Z1)[0]}
          y2={iso(x1 - 0.04, midY, Z1)[1]}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
        />
      )}

      {/* Halo amber si highlighted */}
      {highlighted && (
        <>
          <polygon
            points={pts([
              iso(x0 - 0.18, y0 - 0.18, Z1 + 0.1),
              iso(x1 + 0.18, y0 - 0.18, Z1 + 0.1),
              iso(x1 + 0.18, y1 + 0.18, Z1 + 0.1),
              iso(x0 - 0.18, y1 + 0.18, Z1 + 0.1),
            ])}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.5"
            opacity={0.9}
          />
          <polygon
            points={pts([
              iso(x0 - 0.32, y0 - 0.32, Z1 + 0.18),
              iso(x1 + 0.32, y0 - 0.32, Z1 + 0.18),
              iso(x1 + 0.32, y1 + 0.32, Z1 + 0.18),
              iso(x0 - 0.32, y1 + 0.32, Z1 + 0.18),
            ])}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1"
            opacity={0.35}
          />
        </>
      )}

      {/* Outline azul si seleccionado */}
      {selected && !highlighted && (
        <polygon
          points={pts([
            iso(x0 - 0.18, y0 - 0.18, Z1 + 0.1),
            iso(x1 + 0.18, y0 - 0.18, Z1 + 0.1),
            iso(x1 + 0.18, y1 + 0.18, Z1 + 0.1),
            iso(x0 - 0.18, y1 + 0.18, Z1 + 0.1),
          ])}
          fill="none"
          stroke="#1E88E5"
          strokeWidth="2"
          strokeDasharray="3 2"
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Etiqueta P1..P8 */}
      {(() => {
        const [lx, ly] = iso((x0 + x1) / 2, (y0 + y1) / 2, labelZ);
        return (
          <text
            x={lx}
            y={ly + 3}
            textAnchor="middle"
            fill="white"
            fontSize="9.5"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            style={{
              userSelect: "none",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))",
              pointerEvents: "none",
            }}
          >
            {pallet.slotId}
          </text>
        );
      })()}
    </g>
  );
}
