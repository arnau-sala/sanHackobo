/**
 * Caja o barril en proyeccion isometrica.
 *
 * Cada caja se renderiza como 3 polygons SVG (top, frente, lateral) con
 * tonos de la paleta del producto. El barril es identico pero con la cara
 * superior elipsoidal.
 *
 * Este componente NO posiciona el box dentro del palet, recibe `origin` ya
 * resuelto en coordenadas de mundo. Es responsabilidad del padre ordenar
 * los box por profundidad antes de renderizar.
 */
import {
  cuboidFrontFace,
  cuboidRightFace,
  cuboidTopFace,
  polygonPoints,
  project,
  type World,
} from "./projection";
import type { Palette } from "./productColors";
import type { RenderBox } from "./buildPalletStack";

export type Box3DProps = {
  origin: World;
  width: number;
  depth: number;
  height: number;
  palette: Palette;
  /** Si true, dibuja en blanco translucido (modo "esto NO es lo de ahora"). */
  ghosted?: boolean;
  /** Si true, lo dibuja con borde dorado (modo "es lo que hay que descargar"). */
  highlighted?: boolean;
  /** Forma fisica: caja o barril. */
  shape?: "box" | "keg" | "bottle";
  /** Etiqueta corta en la cara superior (e.g. "ED", "AV"). */
  badge?: string;
  /** Click handler (opcional). */
  onClick?: () => void;
  /** Indica que el item esta retornable (anade simbolo). */
  returnable?: boolean;
};

const GHOST_FILL = "#f5f7fa";
const GHOST_STROKE = "#cbd5e1";
const HIGHLIGHT_STROKE = "#fbbf24";

export function Box3D(props: Box3DProps) {
  const { origin, width: w, depth: d, height: h, palette, ghosted, highlighted } = props;
  const shape = props.shape ?? "box";

  const top = cuboidTopFace(origin, w, d, h);
  const front = cuboidFrontFace(origin, w, d, h);
  const right = cuboidRightFace(origin, w, d, h);

  const fillTop = ghosted ? GHOST_FILL : palette.top;
  const fillFront = ghosted ? "#e2e8f0" : palette.front;
  const fillSide = ghosted ? "#cbd5e1" : palette.side;
  const stroke = ghosted ? GHOST_STROKE : "#0f172a22";
  const highlightStroke = highlighted ? HIGHLIGHT_STROKE : undefined;
  const highlightWidth = highlighted ? 2.5 : 0.6;

  // Cara superior (rombo). Para barrel renderizamos una elipse aproximada
  // dentro del cuadrilatero proyectado.
  let topElement: JSX.Element;
  if (shape === "keg") {
    // Centro y radios aproximados de la elipse top
    const cx = (project(top[0]).x + project(top[2]).x) / 2;
    const cy = (project(top[0]).y + project(top[2]).y) / 2;
    const rx = Math.abs(project(top[1]).x - project(top[3]).x) / 2;
    const ry = Math.abs(project(top[2]).y - project(top[0]).y) / 2;
    topElement = (
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={fillTop}
        stroke={highlightStroke ?? stroke}
        strokeWidth={highlightWidth}
      />
    );
  } else {
    topElement = (
      <polygon
        points={polygonPoints(top)}
        fill={fillTop}
        stroke={highlightStroke ?? stroke}
        strokeWidth={highlightWidth}
        strokeLinejoin="round"
      />
    );
  }

  return (
    <g
      onClick={props.onClick}
      style={{ cursor: props.onClick ? "pointer" : "default" }}
    >
      <polygon
        points={polygonPoints(front)}
        fill={fillFront}
        stroke={highlightStroke ?? stroke}
        strokeWidth={highlightWidth}
        strokeLinejoin="round"
      />
      <polygon
        points={polygonPoints(right)}
        fill={fillSide}
        stroke={highlightStroke ?? stroke}
        strokeWidth={highlightWidth}
        strokeLinejoin="round"
      />
      {topElement}
      {props.badge && (
        <text
          x={(project(top[0]).x + project(top[2]).x) / 2}
          y={(project(top[0]).y + project(top[2]).y) / 2 + 3}
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill={ghosted ? "#94a3b8" : "#ffffff"}
          style={{ pointerEvents: "none" }}
        >
          {props.badge}
        </text>
      )}
      {props.returnable && !ghosted && (
        <text
          x={(project(top[0]).x + project(top[2]).x) / 2}
          y={(project(top[0]).y + project(top[2]).y) / 2 - 4}
          textAnchor="middle"
          fontSize="9"
          fill="#fff"
          style={{ pointerEvents: "none" }}
        >
          ♻
        </text>
      )}
    </g>
  );
}

/** Crea una etiqueta corta a partir de un productId. */
export function shortBadge(box: RenderBox): string {
  const id = box.productId;
  // ED13 → ED, FDT13 → FDT, 0AM4905 → AM
  const m = id.match(/^[0]?([A-Z]+)/);
  if (m) return m[1].slice(0, 3);
  return id.slice(0, 2);
}
