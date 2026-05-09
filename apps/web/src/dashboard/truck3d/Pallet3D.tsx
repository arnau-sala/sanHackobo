/**
 * Palet 3D = base de madera + N boxes apilados.
 *
 * Recibe el palet ya posicionado en el mundo (origin) y la lista de
 * RenderBox preprocesada por buildPalletStack. Renderiza:
 *
 *   1. Base de madera (3 caras visibles).
 *   2. Boxes ordenados por profundidad para que se solapen bien.
 *   3. Etiqueta P1..P8 con la prioridad/lateral.
 *   4. Bandera "↓ Recoger aqui" si highlighted=true.
 */
import type React from "react";
import { Box3D, shortBadge } from "./Box3D";
import type { RenderBox } from "./buildPalletStack";
import { DEFAULT_GEOMETRY, type PalletGeometry } from "./palletGeometry";
import {
  cuboidFrontFace,
  cuboidRightFace,
  cuboidTopFace,
  depthKey,
  polygonPoints,
  project,
  type World,
} from "./projection";

export type Pallet3DProps = {
  /** Esquina inferior-trasera-izquierda en coordenadas mundo. */
  origin: World;
  /** Items ya filtrados (sin los entregados). */
  boxes: RenderBox[];
  /** ID del palet para etiquetar. */
  slotId: string;
  /** Si true, este palet esta seleccionado (popup abierto). */
  selected?: boolean;
  /** Si true, este palet contiene la entrega activa (modo proxima parada). */
  highlighted?: boolean;
  /** Si true, este palet pasa a "ghosted" (modo proxima parada con otro pallet activo). */
  ghosted?: boolean;
  /** stopId que esta a punto de descargarse — sus boxes se resaltan en color. */
  highlightStopId?: string | null;
  /** Click en cualquier zona del palet. */
  onSelect?: (slotId: string) => void;
  /** Click en una caja concreta (para el chat o la guia "donde esta lo de X"). */
  onBoxClick?: (box: RenderBox) => void;
  geometry?: PalletGeometry;
};

const WOOD_TOP = "#caa470";
const WOOD_FRONT = "#8b6135";
const WOOD_SIDE = "#5e3f1f";
const WOOD_GHOST_TOP = "#e8ecf2";
const WOOD_GHOST_FRONT = "#d4dae2";
const WOOD_GHOST_SIDE = "#bdc3cd";

export function Pallet3D(props: Pallet3DProps) {
  const geo = props.geometry ?? DEFAULT_GEOMETRY;
  const { origin, boxes, slotId, ghosted, highlighted, highlightStopId } = props;

  // 1. Base de madera (3 polygons).
  const baseTop = cuboidTopFace(origin, geo.width, geo.depth, geo.baseHeight);
  const baseFront = cuboidFrontFace(origin, geo.width, geo.depth, geo.baseHeight);
  const baseRight = cuboidRightFace(origin, geo.width, geo.depth, geo.baseHeight);
  const woodTop = ghosted ? WOOD_GHOST_TOP : WOOD_TOP;
  const woodFront = ghosted ? WOOD_GHOST_FRONT : WOOD_FRONT;
  const woodSide = ghosted ? WOOD_GHOST_SIDE : WOOD_SIDE;

  // 2. Boxes: para cada uno calculamos su origin local y depth para
  //    ordenar bien.
  const cellW = geo.width / 2;
  const cellD = geo.depth / 2;
  const renderable = boxes.map((b) => {
    const localX = origin.x + b.cellX * cellW + (cellW - geo.boxWidth) / 2;
    const localY = origin.y + b.cellY * cellD + (cellD - geo.boxDepth) / 2;
    const localZ = origin.z + geo.baseHeight + b.layer * geo.boxHeight;
    return {
      box: b,
      origin: { x: localX, y: localY, z: localZ } as World,
      depth: depthKey({
        x: localX + geo.boxWidth / 2,
        y: localY + geo.boxDepth / 2,
        z: localZ + geo.boxHeight / 2,
      }),
    };
  });
  // Pintamos primero los del fondo (depthKey menor).
  renderable.sort((a, b) => a.depth - b.depth);

  // 3. Etiqueta P1 etc — la posicionamos sobre el palet, en la esquina
  //    superior visible del frente.
  const labelAnchor = project({
    x: origin.x + geo.width * 0.5,
    y: origin.y - 2,
    z: origin.z + geo.baseHeight + 4,
  });

  // 4. Recoger aqui — banderita amarilla si highlighted.
  const flagAnchor = project({
    x: origin.x + geo.width * 0.5,
    y: origin.y,
    z: origin.z + geo.baseHeight + (boxes.length === 0 ? 0 : 3) * geo.boxHeight + 18,
  });

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onSelect?.(slotId);
  };

  return (
    <g
      data-slot={slotId}
      onClick={handleSelect}
      style={{ cursor: props.onSelect ? "pointer" : "default" }}
    >
      {/* Base */}
      <polygon
        points={polygonPoints(baseFront)}
        fill={woodFront}
        stroke="#0f172a22"
        strokeWidth={0.4}
      />
      <polygon
        points={polygonPoints(baseRight)}
        fill={woodSide}
        stroke="#0f172a22"
        strokeWidth={0.4}
      />
      <polygon
        points={polygonPoints(baseTop)}
        fill={woodTop}
        stroke="#0f172a33"
        strokeWidth={0.4}
      />

      {/* Boxes apilados */}
      {renderable.map(({ box, origin: o }) => {
        const isHighlightedBox =
          !!highlightStopId && box.stopId === highlightStopId;
        const isGhostedBox = ghosted && !isHighlightedBox;
        return (
          <Box3D
            key={box.key}
            origin={o}
            width={geo.boxWidth}
            depth={geo.boxDepth}
            height={geo.boxHeight}
            palette={box.palette}
            shape={box.handlingType === "keg" ? "keg" : "box"}
            ghosted={isGhostedBox}
            highlighted={isHighlightedBox}
            badge={shortBadge(box)}
            returnable={box.returnable}
            onClick={
              props.onBoxClick
                ? (event?: unknown) => {
                    // detener bubbling para que el click en la caja no
                    // dispare tambien el onSelect del palet
                    if (event && typeof (event as Event).stopPropagation === "function") {
                      (event as Event).stopPropagation();
                    }
                    props.onBoxClick?.(box);
                  }
                : undefined
            }
          />
        );
      })}

      {/* Etiqueta del palet */}
      <g style={{ pointerEvents: "none" }}>
        <rect
          x={labelAnchor.x - 14}
          y={labelAnchor.y - 14}
          width={28}
          height={18}
          rx={4}
          fill={highlighted ? "#fbbf24" : ghosted ? "#e2e8f0" : "#1f2937"}
          stroke={highlighted ? "#92400e" : "#0f172a"}
          strokeWidth={0.6}
        />
        <text
          x={labelAnchor.x}
          y={labelAnchor.y - 1}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={highlighted ? "#7c2d12" : ghosted ? "#475569" : "#fff"}
        >
          {slotId}
        </text>
      </g>

      {/* Bandera "Recoger aqui" */}
      {highlighted && boxes.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          <line
            x1={flagAnchor.x}
            y1={flagAnchor.y + 6}
            x2={flagAnchor.x + 60}
            y2={flagAnchor.y - 14}
            stroke="#fbbf24"
            strokeWidth={2}
          />
          <rect
            x={flagAnchor.x + 56}
            y={flagAnchor.y - 28}
            width={108}
            height={22}
            rx={6}
            fill="#fbbf24"
            stroke="#92400e"
            strokeWidth={1}
          />
          <text
            x={flagAnchor.x + 110}
            y={flagAnchor.y - 13}
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="#7c2d12"
          >
            ↓ Recoger aqui
          </text>
        </g>
      )}

      {/* Anillo de seleccion */}
      {props.selected && (
        <polygon
          points={polygonPoints(baseTop)}
          fill="none"
          stroke="#1e88e5"
          strokeWidth={2.5}
          strokeDasharray="4 3"
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}
