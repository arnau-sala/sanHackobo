/**
 * Caja del camion (suelo + paredes + cabina) en isometrico.
 *
 * Port directo del export del Figma (`interfaz_camion`). Usa coordenadas
 * mundo absolutas (TW=8, TD=12, TH=4.5) y, gracias a la proyeccion fija
 * en `projection.ts`, encaja siempre en el viewBox 680x400.
 *
 * Composicion:
 *   - Cabina (delante del trailer, en y negativa): chasis + cabina
 *     bicolor + ventanas, parrilla, faros, deflector y rueda delantera.
 *   - Pared frontal del trailer (y=0) en blanco liso + logo Damm.
 *   - Suelo (z=0) gris claro con linea central de pasillo.
 */
import { iso, pts } from "./projection";

export const TW = 8;
export const TD = 12;
export const TH = 4.5;

/** Rojo puro: cara frontal de la cabina y logo Damm en la pared (mismo tono). */
const CABIN_FRONT_RED = "#FF0000";

/** Textura plana (u,v) en [0,1]² → cara frontal del trailer y=0 (x,z mundo). */
function trailerFrontLogoMatrix(): string {
  const marginX = 0.2 * TW;
  const marginZBot = 0.14 * TH;
  const marginZTop = 0.22 * TH;
  const zTop = TH - marginZTop;
  const zBot = marginZBot;
  const q00 = iso(marginX, 0, zTop);
  const q10 = iso(TW - marginX, 0, zTop);
  const q01 = iso(marginX, 0, zBot);
  const ex0 = q10[0] - q00[0];
  const ex1 = q10[1] - q00[1];
  const ey0 = q01[0] - q00[0];
  const ey1 = q01[1] - q00[1];
  return `matrix(${ex0},${ex1},${ey0},${ey1},${q00[0]},${q00[1]})`;
}

export function TruckShell() {
  return (
    <g data-truck-shell>
      <defs>
        {/*
          Fondo negro del PNG → transparente; mismo rojo que la cara frontal de la cabina.
        */}
        <filter
          id="dammWallLogoPaint"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lumaMask" />
          <feFlood floodColor={CABIN_FRONT_RED} floodOpacity="1" result="redFlood" />
          <feComposite in="redFlood" in2="lumaMask" operator="in" result="logoRed" />
        </filter>
      </defs>

      <TruckCabin />

      {/* Pared frontal del trailer (detras de los palets) */}
      <polygon
        points={pts([iso(0, 0, 0), iso(TW, 0, 0), iso(TW, 0, TH), iso(0, 0, TH)])}
        fill="#F3F4F6"
        stroke="none"
      />
      <image
        href={`${import.meta.env.BASE_URL}damm-truck-logo.png`}
        width={1}
        height={1}
        preserveAspectRatio="xMidYMid meet"
        transform={trailerFrontLogoMatrix()}
        filter="url(#dammWallLogoPaint)"
        style={{ pointerEvents: "none" }}
      />

      {/* Halo gris bajo el remolque */}
      <polygon
        points={pts([
          iso(-0.1, -0.1, -0.1),
          iso(TW + 0.1, -0.1, -0.1),
          iso(TW + 0.1, TD + 0.1, -0.1),
          iso(-0.1, TD + 0.1, -0.1),
        ])}
        fill="#D1D5DB"
      />

      {/* Suelo del trailer */}
      <polygon
        points={pts([iso(0, 0, 0), iso(TW, 0, 0), iso(TW, TD, 0), iso(0, TD, 0)])}
        fill="#F9FAFB"
      />

      {/* Linea central a rayas (pasillo) */}
      <line
        x1={iso(4, 0, 0.02)[0]}
        y1={iso(4, 0, 0.02)[1]}
        x2={iso(4, TD, 0.02)[0]}
        y2={iso(4, TD, 0.02)[1]}
        stroke="#E5E7EB"
        strokeWidth="1.1"
        strokeDasharray="5,5"
      />
    </g>
  );
}

function TruckCabin() {
  const cx0 = 0.5;
  const cx1 = 7.5;
  const cy0 = -3.5;
  const cy1 = -0.2;
  const cz1 = 3.2;
  const czChassis = 0.5;

  return (
    <g className="truck-cabin">
      {/* Chasis - cara derecha + frontal */}
      <polygon
        points={pts([
          iso(cx1, cy0, 0),
          iso(cx1, cy1, 0),
          iso(cx1, cy1, czChassis),
          iso(cx1, cy0, czChassis),
        ])}
        fill="#1F2937"
      />
      <polygon
        points={pts([
          iso(cx0, cy0, 0),
          iso(cx1, cy0, 0),
          iso(cx1, cy0, czChassis),
          iso(cx0, cy0, czChassis),
        ])}
        fill="#030712"
      />

      {/* Cabina rojo - cara derecha + frontal */}
      <polygon
        points={pts([
          iso(cx1, cy0, czChassis),
          iso(cx1, cy1, czChassis),
          iso(cx1, cy1, cz1),
          iso(cx1, cy0, cz1),
        ])}
        fill="#A30D1B"
      />
      <polygon
        points={pts([
          iso(cx0, cy0, czChassis),
          iso(cx1, cy0, czChassis),
          iso(cx1, cy0, cz1),
          iso(cx0, cy0, cz1),
        ])}
        fill={CABIN_FRONT_RED}
      />

      {/* Parabrisas */}
      <polygon
        points={pts([
          iso(cx0 + 0.5, cy0, czChassis + 1.0),
          iso(cx1 - 0.5, cy0, czChassis + 1.0),
          iso(cx1 - 0.5, cy0, cz1 - 0.4),
          iso(cx0 + 0.5, cy0, cz1 - 0.4),
        ])}
        fill="#1E3A8A"
        opacity={0.8}
      />
      {/* Ventana lateral */}
      <polygon
        points={pts([
          iso(cx1, cy0 + 0.4, czChassis + 1.0),
          iso(cx1, cy1 - 0.6, czChassis + 1.0),
          iso(cx1, cy1 - 0.6, cz1 - 0.4),
          iso(cx1, cy0 + 0.4, cz1 - 0.4),
        ])}
        fill="#1E3A8A"
        opacity={0.8}
      />

      {/* Parrilla */}
      <polygon
        points={pts([
          iso(cx0 + 2.5, cy0, czChassis + 0.1),
          iso(cx1 - 2.5, cy0, czChassis + 0.1),
          iso(cx1 - 2.5, cy0, czChassis + 0.8),
          iso(cx0 + 2.5, cy0, czChassis + 0.8),
        ])}
        fill="#000000"
      />
      {/* Faros */}
      <polygon
        points={pts([
          iso(cx0 + 0.8, cy0, czChassis + 0.3),
          iso(cx0 + 1.8, cy0, czChassis + 0.3),
          iso(cx0 + 1.8, cy0, czChassis + 0.6),
          iso(cx0 + 0.8, cy0, czChassis + 0.6),
        ])}
        fill="#FDF08B"
      />
      <polygon
        points={pts([
          iso(cx1 - 1.8, cy0, czChassis + 0.3),
          iso(cx1 - 0.8, cy0, czChassis + 0.3),
          iso(cx1 - 0.8, cy0, czChassis + 0.6),
          iso(cx1 - 1.8, cy0, czChassis + 0.6),
        ])}
        fill="#FDF08B"
      />

      {/* Deflector del techo */}
      <polygon
        points={pts([
          iso(cx0, cy0, cz1),
          iso(cx1, cy0, cz1),
          iso(cx1, cy1, cz1 + 1.3),
          iso(cx0, cy1, cz1 + 1.3),
        ])}
        fill="#E61527"
      />
      <polygon
        points={pts([
          iso(cx1, cy0, cz1),
          iso(cx1, cy1, cz1),
          iso(cx1, cy1, cz1 + 1.3),
        ])}
        fill="#8A0B17"
      />

      {/* Rueda delantera derecha */}
      <polygon
        points={pts([
          iso(cx1, cy0 + 0.6, 0.4),
          iso(cx1, cy0 + 1.6, 0.4),
          iso(cx1, cy0 + 1.6, -0.6),
          iso(cx1, cy0 + 0.6, -0.6),
        ])}
        fill="#111827"
      />
      <polygon
        points={pts([
          iso(cx1, cy0 + 0.9, 0.1),
          iso(cx1, cy0 + 1.3, 0.1),
          iso(cx1, cy0 + 1.3, -0.3),
          iso(cx1, cy0 + 0.9, -0.3),
        ])}
        fill="#9CA3AF"
      />

    </g>
  );
}
