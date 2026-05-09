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
import { BRANDS, type Brand } from "./figmaBrands";
import type { RenderColumn, RenderPallet } from "./palletRenderModel";

const BASE_H = 0.3; // altura de la base de madera
const Z1 = 1.42; // altura total palet + carga
const LAYER_H = (Z1 - BASE_H) / 2; // altura de cada capa de cajas

/** Oscurece un hex #RRGGBB para caras interiores / suelo del cajon. */
function shadeHex(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const t = Math.max(0, Math.min(1, 1 - factor));
  const rr = Math.round(r * t);
  const gg = Math.round(g * t);
  const bb = Math.round(b * t);
  return `rgb(${rr},${gg},${bb})`;
}

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

/** Rejilla fina interior del cajon (separadores de botellas). */
function CrateDividerGrid({
  ix0,
  ix1,
  iy0,
  iy1,
  z,
  gridCols,
  gridRows,
  stroke,
}: {
  ix0: number;
  ix1: number;
  iy0: number;
  iy1: number;
  z: number;
  gridCols: number;
  gridRows: number;
  stroke: string;
}) {
  const ze = z + 0.018;
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < gridCols; i++) {
    const tx = ix0 + (i / gridCols) * (ix1 - ix0);
    lines.push(
      <line
        key={`dv${i}`}
        x1={iso(tx, iy0, ze)[0]}
        y1={iso(tx, iy0, ze)[1]}
        x2={iso(tx, iy1, ze)[0]}
        y2={iso(tx, iy1, ze)[1]}
        stroke={stroke}
        strokeWidth={0.28}
        opacity={0.5}
      />,
    );
  }
  for (let j = 1; j < gridRows; j++) {
    const ty = iy0 + (j / gridRows) * (iy1 - iy0);
    lines.push(
      <line
        key={`dh${j}`}
        x1={iso(ix0, ty, ze)[0]}
        y1={iso(ix0, ty, ze)[1]}
        x2={iso(ix1, ty, ze)[0]}
        y2={iso(ix1, ty, ze)[1]}
        stroke={stroke}
        strokeWidth={0.28}
        opacity={0.5}
      />,
    );
  }
  return <>{lines}</>;
}

/**
 * Botella de cristal en altura real del cajon: de zFloor hasta cerca de zRim
 * (borde superior abierto), usando cortes horizontales en proyeccion isometrica.
 */
function GlassBeerBottle({
  px,
  py,
  zFloor,
  zRim,
}: {
  px: number;
  py: number;
  /** Base del cuerpo sobre el fondo del cajon. */
  zFloor: number;
  /** Altura maxima (chapita un poco por debajo del aro del plastico). */
  zRim: number;
}) {
  const h = Math.max(0.06, zRim - zFloor);
  /** Cortes desde la base hasta casi zRim para que el perfil llene el cajon. */
  const slices: { t: number; rx: number; ry: number; fill: string; op: number }[] = [
    { t: 0.03, rx: 1.18, ry: 0.82, fill: "#14100C", op: 0.98 },
    { t: 0.1, rx: 1.26, ry: 0.88, fill: "#18100E", op: 0.97 },
    { t: 0.18, rx: 1.3, ry: 0.92, fill: "#1A120E", op: 0.97 },
    { t: 0.26, rx: 1.32, ry: 0.93, fill: "#1E1410", op: 0.96 },
    { t: 0.34, rx: 1.3, ry: 0.91, fill: "#221812", op: 0.95 },
    { t: 0.42, rx: 1.24, ry: 0.87, fill: "#261812", op: 0.95 },
    { t: 0.5, rx: 1.12, ry: 0.78, fill: "#2E1C14", op: 0.94 },
    { t: 0.57, rx: 0.98, ry: 0.68, fill: "#362018", op: 0.93 },
    { t: 0.64, rx: 0.84, ry: 0.58, fill: "#3D2818", op: 0.92 },
    { t: 0.71, rx: 0.7, ry: 0.48, fill: "#4A3228", op: 0.91 },
    { t: 0.77, rx: 0.58, ry: 0.4, fill: "#56362C", op: 0.9 },
    { t: 0.83, rx: 0.48, ry: 0.33, fill: "#624038", op: 0.89 },
    { t: 0.88, rx: 0.4, ry: 0.28, fill: "#6A4838", op: 0.87 },
    { t: 0.92, rx: 0.35, ry: 0.24, fill: "#6D4C41", op: 0.85 },
    { t: 0.96, rx: 0.32, ry: 0.22, fill: "#5C4038", op: 0.82 },
  ];

  const [hx, hy] = iso(px, py, zFloor + h * 0.3);

  return (
    <g>
      {slices.map((s, i) => {
        const z = zFloor + h * s.t;
        const [cx, cy] = iso(px, py, z);
        return (
          <ellipse
            key={`s${i}`}
            cx={cx}
            cy={cy}
            rx={s.rx}
            ry={s.ry}
            fill={s.fill}
            opacity={s.op}
          />
        );
      })}
      <ellipse
        cx={hx - 0.48}
        cy={hy + 0.1}
        rx={0.42}
        ry={0.72}
        fill="#FFFFFF"
        opacity={0.11}
      />
      {(() => {
        const [lx, ly] = iso(px, py, zFloor + h * 0.4);
        return (
          <rect
            x={lx - 0.68}
            y={ly - 0.58}
            width={1.36}
            height={0.48}
            rx={0.11}
            fill="#F5E6D3"
            opacity={0.9}
            stroke="rgba(180,140,90,0.38)"
            strokeWidth={0.16}
          />
        );
      })()}
      {(() => {
        const zC = zRim - 0.006;
        const [cx, cy] = iso(px, py, zC);
        return (
          <>
            <ellipse
              cx={cx}
              cy={cy}
              rx={0.48}
              ry={0.34}
              fill="#D4AF37"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={0.2}
            />
            <ellipse cx={cx - 0.11} cy={cy - 0.09} rx={0.15} ry={0.09} fill="#FFF8E1" opacity={0.45} />
          </>
        );
      })()}
    </g>
  );
}

// ── Cajon de plastico abierto por arriba (apilable) ─────────────────
function OpenCrateLayer({
  x0,
  x1,
  y0,
  y1,
  lz0,
  lz1,
  brand,
  withBottles,
  bottleFill = "full",
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  lz0: number;
  lz1: number;
  brand: Brand;
  /** false = cajon vacio (solo rejilla, sin botellas). */
  withBottles: boolean;
  /** Con una sola capa logica en el modelo se usa "half" para leerse como menos lleno. */
  bottleFill?: "full" | "half";
}) {
  const xMid = (x0 + x1) / 2;
  const yMid = (y0 + y1) / 2;
  const wall = Math.min(0.045, (x1 - x0) * 0.11, (y1 - y0) * 0.11);
  const ix0 = x0 + wall;
  const ix1 = x1 - wall;
  const iy0 = y0 + wall;
  const iy1 = y1 - wall;
  const zInner = lz0 + wall * 0.9;
  /** Base casi en el fondo; coronas hasta el aro superior del cajon abierto. */
  const zBottleFloor = zInner + 0.012;
  const zBottleTop = lz1 - 0.018;

  const innerSide = shadeHex(brand.side, 0.5);
  const floorFill = shadeHex(brand.top, 0.55);
  const gridStroke = shadeHex(brand.side, 0.35);

  const bw = Math.max(ix1 - ix0, 0.08);
  const bd = Math.max(iy1 - iy0, 0.08);
  const gridCols = Math.max(3, Math.min(5, Math.round(bw / 0.18)));
  const gridRows = Math.max(3, Math.min(5, Math.round(bd / 0.13)));

  const bottleNodes: React.ReactNode[] = [];
  if (withBottles) {
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (bottleFill === "half" && (r + c) % 2 === 0) {
          continue;
        }
        const px = ix0 + ((c + 0.5) / gridCols) * bw;
        const py = iy0 + ((r + 0.5) / gridRows) * bd;
        bottleNodes.push(
          <GlassBeerBottle
            key={`${r}-${c}`}
            px={px}
            py={py}
            zFloor={zBottleFloor}
            zRim={zBottleTop}
          />,
        );
      }
    }
  }

  return (
    <>
      {/* Suelo interior del cajon */}
      <polygon
        points={pts([
          iso(ix0, iy0, zInner),
          iso(ix1, iy0, zInner),
          iso(ix1, iy1, zInner),
          iso(ix0, iy1, zInner),
        ])}
        fill={floorFill}
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.35}
      />

      <CrateDividerGrid
        ix0={ix0}
        ix1={ix1}
        iy0={iy0}
        iy1={iy1}
        z={zInner}
        gridCols={gridCols}
        gridRows={gridRows}
        stroke={gridStroke}
      />

      {/* Pared trasera (y1) */}
      <polygon
        points={pts([
          iso(x0, y1, lz0),
          iso(x1, y1, lz0),
          iso(x1, y1, lz1),
          iso(x0, y1, lz1),
        ])}
        fill={innerSide}
        opacity={0.92}
      />

      {/* Pared izquierda del mundo (x0) */}
      <polygon
        points={pts([
          iso(x0, y0, lz0),
          iso(x0, y1, lz0),
          iso(x0, y1, lz1),
          iso(x0, y0, lz1),
        ])}
        fill={shadeHex(brand.side, 0.15)}
        opacity={0.88}
      />

      {/* Pared derecha (x1) */}
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
        x1={iso(x1, yMid, lz0)[0]}
        y1={iso(x1, yMid, lz0)[1]}
        x2={iso(x1, yMid, lz1)[0]}
        y2={iso(x1, yMid, lz1)[1]}
        stroke="rgba(0,0,0,0.28)"
        strokeWidth={0.45}
      />
      {/* Asa simple (recorte sugerido en el lateral) */}
      <ellipse
        cx={iso(x1, yMid, (lz0 + lz1) * 0.52)[0]}
        cy={iso(x1, yMid, (lz0 + lz1) * 0.52)[1]}
        rx={2.1}
        ry={1.15}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={0.55}
      />

      {/* Pared frontal (y0) */}
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
        stroke="rgba(0,0,0,0.32)"
        strokeWidth={0.55}
      />

      {/* Contenido encima del frontal para leerse como boca abierta */}
      {bottleNodes}

      {/* Aro / borde superior abierto (sin tapa) */}
      <path
        d={`M ${iso(x0, y0, lz1)[0]},${iso(x0, y0, lz1)[1]} L ${iso(x1, y0, lz1)[0]},${iso(x1, y0, lz1)[1]} L ${iso(x1, y1, lz1)[0]},${iso(x1, y1, lz1)[1]} L ${iso(x0, y1, lz1)[0]},${iso(x0, y1, lz1)[1]} Z`}
        fill="none"
        stroke={shadeHex(brand.front, 0.08)}
        strokeWidth={1.15}
        strokeLinejoin="round"
      />
      <path
        d={`M ${iso(x0, y0, lz1)[0]},${iso(x0, y0, lz1)[1]} L ${iso(x1, y0, lz1)[0]},${iso(x1, y0, lz1)[1]} L ${iso(x1, y1, lz1)[0]},${iso(x1, y1, lz1)[1]} L ${iso(x0, y1, lz1)[0]},${iso(x0, y1, lz1)[1]} Z`}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={0.35}
        opacity={0.9}
      />
    </>
  );
}

function BoxStack({
  x0,
  x1,
  y0,
  y1,
  zBase,
  layers,
  brand,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  zBase: number;
  /** numero de capas a renderizar (0/1/2). */
  layers: 0 | 1 | 2;
  brand: Brand;
}) {
  const tierH = LAYER_H - 0.025;

  if (layers === 0) {
    const lz0 = zBase;
    const lz1 = zBase + tierH;
    return (
      <OpenCrateLayer
        x0={x0}
        x1={x1}
        y0={y0}
        y1={y1}
        lz0={lz0}
        lz1={lz1}
        brand={brand}
        withBottles={false}
      />
    );
  }

  const fillMode: "full" | "half" = layers >= 2 ? "full" : "half";

  return (
    <>
      {Array.from({ length: layers }, (_, i) => {
        const lz0 = zBase + i * LAYER_H + (i > 0 ? 0.025 : 0);
        const lz1 = zBase + (i + 1) * LAYER_H - 0.025;
        return (
          <OpenCrateLayer
            key={i}
            x0={x0}
            x1={x1}
            y0={y0}
            y1={y1}
            lz0={lz0}
            lz1={lz1}
            brand={brand}
            withBottles
            bottleFill={fillMode}
          />
        );
      })}
    </>
  );
}

/** Circulo en planta (x,y) a z fijo → poligono en pantalla (aprox. elipse isometrica). */
function isoCirclePts(cxW: number, cyW: number, z: number, r: number, n: number): string {
  const ring: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    ring.push(iso(cxW + r * Math.cos(t), cyW + r * Math.sin(t), z));
  }
  return pts(ring);
}

/**
 * Barril como cilindro vertical (malla en planta), mas alto que ancho: radio
 * estrecho respecto a la celda. Gris metalizado, aros, chapa hundida y valvula.
 */
function StainlessKeg({
  x0,
  x1,
  y0,
  y1,
  z0,
  z1,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cell = Math.min(x1 - x0, y1 - y0);
  /** Radio grande en planta para llenar bien el hueco horizontal de la celda. */
  const r = cell * 0.47;
  const h = z1 - z0;
  const SEG = 22;
  const RIB_T = [0.26, 0.5, 0.74];
  const RIB_DR = 0.045;
  const RIB_DZ = 0.022;

  const gray = (light: number) => {
    const L = Math.min(1, Math.max(0, light));
    const v = Math.round(148 + L * 48);
    return `rgb(${v},${v + 2},${v + 5})`;
  };

  type SortEl = { d: number; node: React.ReactNode };
  const bucket: SortEl[] = [];

  for (let i = 0; i < SEG; i++) {
    const t0 = (2 * Math.PI * i) / SEG;
    const t1 = (2 * Math.PI * (i + 1)) / SEG;
    const tm = (t0 + t1) / 2;
    const x00 = cx + r * Math.cos(t0);
    const y00 = cy + r * Math.sin(t0);
    const x01 = cx + r * Math.cos(t1);
    const y01 = cy + r * Math.sin(t1);
    const wxm = cx + r * Math.cos(tm);
    const wym = cy + r * Math.sin(tm);
    const d = wxm + wym;
    const light = 0.55 + 0.45 * Math.sin(tm + 0.35);
    bucket.push({
      d,
      node: (
        <polygon
          key={`cyl${i}`}
          points={pts([
            iso(x00, y00, z0),
            iso(x01, y01, z0),
            iso(x01, y01, z1),
            iso(x00, y00, z1),
          ])}
          fill={gray(light)}
          stroke="rgba(60,65,75,0.12)"
          strokeWidth={0.15}
        />
      ),
    });
  }

  for (const rt of RIB_T) {
    const hz = z0 + rt * h;
    for (let i = 0; i < SEG; i++) {
      const t0 = (2 * Math.PI * i) / SEG;
      const t1 = (2 * Math.PI * (i + 1)) / SEG;
      const tm = (t0 + t1) / 2;
      const rOuter = r + RIB_DR;
      const x00 = cx + rOuter * Math.cos(t0);
      const y00 = cy + rOuter * Math.sin(t0);
      const x01 = cx + rOuter * Math.cos(t1);
      const y01 = cy + rOuter * Math.sin(t1);
      const wxm = cx + rOuter * Math.cos(tm);
      const wym = cy + rOuter * Math.sin(tm);
      bucket.push({
        d: wxm + wym + 0.001,
        node: (
          <polygon
            key={`rib${rt}-${i}`}
            points={pts([
              iso(x00, y00, hz - RIB_DZ),
              iso(x01, y01, hz - RIB_DZ),
              iso(x01, y01, hz + RIB_DZ),
              iso(x00, y00, hz + RIB_DZ),
            ])}
            fill="#8B929E"
            opacity={0.92}
          />
        ),
      });
    }
  }

  bucket.sort((a, b) => a.d - b.d);

  const rChime = r * 1.07;
  const zTop = z1;
  const zDeck = z1 - 0.05;
  const rDeck = r * 0.9;
  const [sx, sy] = iso(cx, cy, zTop);

  return (
    <>
      {/* Suelo inferior del cilindro (sombra de contacto) */}
      <polygon
        points={isoCirclePts(cx, cy, z0 + 0.01, r * 1.02, SEG)}
        fill="#8E95A3"
        opacity={0.35}
      />
      {bucket.map((b, j) => (
        <React.Fragment key={j}>{b.node}</React.Fragment>
      ))}
      {/* Aro / chapa superior */}
      <polygon
        points={isoCirclePts(cx, cy, zTop, rChime, SEG)}
        fill="#C5CBD4"
        stroke="#9AA2AE"
        strokeWidth={0.45}
      />
      {/* Hueco hundido en la tapa */}
      <polygon
        points={isoCirclePts(cx, cy, zDeck, rDeck, SEG)}
        fill="#A8AFBA"
        stroke="rgba(70,75,85,0.25)"
        strokeWidth={0.3}
      />
      {/* Recortes tipo asa en el borde (referencia visual, sin etiquetas). */}
      {[
        { ang: Math.PI * 0.38 },
        { ang: Math.PI * (1 - 0.38) },
      ].map((H, hi) => {
        const wx = cx + rChime * 0.82 * Math.cos(H.ang);
        const wy = cy + rChime * 0.82 * Math.sin(H.ang);
        const [px, py] = iso(wx, wy, zTop);
        return (
          <ellipse
            key={`han${hi}`}
            cx={px}
            cy={py}
            rx={1.05}
            ry={0.52}
            fill="none"
            stroke="rgba(55,60,70,0.42)"
            strokeWidth={0.38}
          />
        );
      })}
      {/* Valvula / espiga central */}
      <circle cx={sx} cy={sy} r={1.15} fill="#2F3238" opacity={0.9} />
      <circle cx={sx} cy={sy} r={0.55} fill="#5C6370" opacity={0.95} />
      <ellipse cx={sx - 0.25} cy={sy - 0.2} rx={0.25} ry={0.18} fill="#FFFFFF" opacity={0.2} />
    </>
  );
}

/** Cuatro barriles de pie en rejilla 2×2 sobre todo el hueco del palet. */
function KegGrid2x2({
  x0,
  x1,
  y0,
  y1,
  stackLayers,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  stackLayers: 0 | 1 | 2;
}) {
  if (stackLayers === 0) return null;
  const z1 = stackLayers >= 2 ? Z1 : BASE_H + (Z1 - BASE_H) * 0.6;
  const pad = 0.08;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const g = 0.065;
  const cells: [number, number, number, number][] = [
    [x0 + pad, mx - g, y0 + pad, my - g],
    [mx + g, x1 - pad, y0 + pad, my - g],
    [x0 + pad, mx - g, my + g, y1 - pad],
    [mx + g, x1 - pad, my + g, y1 - pad],
  ];

  return (
    <>
      {cells.map(([kx0, kx1, ky0, ky1], i) => (
        <StainlessKeg key={i} x0={kx0} x1={kx1} y0={ky0} y1={ky1} z0={BASE_H} z1={z1} />
      ))}
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
    return (
      <BoxStack
        x0={bx0}
        x1={bx1}
        y0={by0}
        y1={by1}
        zBase={BASE_H}
        layers={col.layers}
        brand={brand}
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

      {/* Carga: palet homogeneo — cajas (2 franjas) o 4 barriles 2×2 */}
      {pallet.cargoKind === "kegs" ? (
        <KegGrid2x2
          x0={x0}
          x1={x1}
          y0={y0}
          y1={y1}
          stackLayers={pallet.cols[0].layers}
        />
      ) : (
        <>
          {renderBand(pallet.cols[0], bandX0, bandX1, band1Y0, band1Y1)}
          {renderBand(pallet.cols[1], bandX0, bandX1, band2Y0, band2Y1)}
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
        </>
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
