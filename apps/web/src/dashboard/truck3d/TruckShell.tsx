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
 *   - Pared frontal del trailer (y=0) en blanco con costillas verticales.
 *   - Suelo (z=0) gris claro con linea central de pasillo.
 */
import { iso, pts } from "./projection";

export const TW = 8;
export const TD = 12;
export const TH = 4.5;

export function TruckShell() {
  return (
    <g data-truck-shell>
      <TruckCabin />

      {/* Pared frontal del trailer (detras de los palets) */}
      <polygon
        points={pts([iso(0, 0, 0), iso(TW, 0, 0), iso(TW, 0, TH), iso(0, 0, TH)])}
        fill="#F3F4F6"
        stroke="#D1D5DB"
        strokeWidth="1"
      />
      {[1, 2, 3, 4, 5, 6, 7].map((x) => (
        <line
          key={`fw${x}`}
          x1={iso(x, 0, 0)[0]}
          y1={iso(x, 0, 0)[1]}
          x2={iso(x, 0, TH)[0]}
          y2={iso(x, 0, TH)[1]}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
      ))}

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
        fill="#CC1122"
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
