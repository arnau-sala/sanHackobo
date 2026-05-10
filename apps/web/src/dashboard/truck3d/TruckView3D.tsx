/**
 * Visualizacion 3D isometrica del camion + 8 palets, port directo del
 * export del Figma (`interfaz_camion`).
 *
 * Layout fijo (4 filas × 2 columnas) en coordenadas mundo:
 *   - Cabina:  y ∈ [-3.5, -0.2], la pintamos detras del trailer.
 *   - Trailer: TW=8 ancho, TD=12 fondo, TH=4.5 alto.
 *   - Palets: P1..P4 en columna izquierda (x ∈ 0.15..2.75),
 *             P5..P8 en columna derecha   (x ∈ 5.25..7.85);
 *             4 filas de y=0.3..2.7, 3.0..5.4, 5.7..8.1, 8.4..10.8.
 *
 * Modos:
 *   - viewMode="general"     todos los palets visibles
 *   - viewMode="next-stop"   los palets que NO contienen la entrega
 *                            activa quedan atenuados; los activos
 *                            llevan halo amber + callout "Recoger aqui"
 *
 * El componente es controlado: recibe `selectedSlotId`, `currentStopId`,
 * `viewMode` y emite `onSelectSlot` (el panel de detalle lo pinta TruckStage).
 * El "vaciado" del camion lo calcula `palletRenderModel` a partir de
 * `deliveredStopIds`.
 */
import { useMemo } from "react";
import type { LoadPlan, PalletSlot } from "@damm/optimizer-load";
import { Pallet3D } from "./Pallet3D";
import { TruckShell } from "./TruckShell";
import { buildRenderPallet, slotBox, type RenderPallet } from "./palletRenderModel";
import { iso } from "./projection";
import styles from "./TruckView3D.module.css";

export type ViewMode = "general" | "next-stop";

const VIEWBOX_W = 380;
const VIEWBOX_H = 220;

export type TruckView3DProps = {
  loadPlan: LoadPlan;
  /** Stops ya entregadas — sus items no se renderizan. */
  deliveredStopIds: Set<string>;
  /** Stop activa (proxima entrega). En modo "next-stop" se resalta su palet. */
  currentStopId?: string | null;
  /** Slot pinchado (para popup). */
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string | null) => void;
  viewMode?: ViewMode;
};

type PlacedPallet = {
  slot: PalletSlot;
  render: RenderPallet;
  bbox: { x0: number; x1: number; y0: number; y1: number };
};

export function TruckView3D({
  loadPlan,
  deliveredStopIds,
  currentStopId,
  selectedSlotId,
  onSelectSlot,
  viewMode = "general",
}: TruckView3DProps) {
  // 1. Render data por palet (figma) + bbox en coords mundo.
  const placed: PlacedPallet[] = useMemo(() => {
    return loadPlan.palletSlots.slice(0, 8).map((slot, index) => {
      const render = buildRenderPallet(slot, { index, deliveredStopIds });
      const bbox = slotBox(render.pos.col, render.pos.row);
      return { slot, render, bbox };
    });
  }, [loadPlan, deliveredStopIds]);

  // 2. Slots que contienen la entrega activa (highlight).
  const highlightedSlotIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentStopId || viewMode !== "next-stop") return set;
    for (const { slot } of placed) {
      if (
        slot.items.some(
          (it) =>
            it.stopId === currentStopId && !deliveredStopIds.has(it.stopId),
        )
      ) {
        set.add(slot.slotId);
      }
    }
    return set;
  }, [placed, currentStopId, deliveredStopIds, viewMode]);

  // 3. Orden de pintado: back-to-front (mas alejado primero).
  const sorted = useMemo(
    () => [...placed].sort((a, b) => a.bbox.x0 + a.bbox.y0 - (b.bbox.x0 + b.bbox.y0)),
    [placed],
  );

  // 4. Callout "↓ Recoger aqui" sobre el palet activo si solo hay uno.
  const calloutSlot =
    viewMode === "next-stop" && highlightedSlotIds.size > 0
      ? placed.find((p) => highlightedSlotIds.has(p.slot.slotId))
      : null;

  return (
    <svg
      className={styles.svg}
      viewBox={`170 90 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      onClick={() => onSelectSlot?.(null)}
    >
      <defs>
        <marker id="truck-arrow" markerWidth="7" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#F59E0B" />
        </marker>
      </defs>

      <TruckShell />

      {sorted.map(({ slot, render, bbox }) => {
        const isHighlighted = highlightedSlotIds.has(slot.slotId);
        const isDimmed = viewMode === "next-stop" && !isHighlighted;
        const isSelected = selectedSlotId === slot.slotId;
        return (
          <Pallet3D
            key={slot.slotId}
            pallet={render}
            bbox={bbox}
            highlighted={isHighlighted}
            dimmed={isDimmed}
            selected={isSelected}
            onSelect={(id) => onSelectSlot?.(id)}
          />
        );
      })}

      {calloutSlot && (
        <Callout
          x0={calloutSlot.bbox.x0}
          x1={calloutSlot.bbox.x1}
          y0={calloutSlot.bbox.y0}
          y1={calloutSlot.bbox.y1}
        />
      )}
    </svg>
  );
}

function Callout({
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
  const Z1 = 1.42;
  const [px, py] = iso((x0 + x1) / 2, (y0 + y1) / 2, Z1 + 0.9);
  const cbx = px + 58;
  const cby = py - 36;
  return (
    <g style={{ pointerEvents: "none" }}>
      <line
        x1={cbx + 2}
        y1={cby + 18}
        x2={px + 2}
        y2={py + 2}
        stroke="#F59E0B"
        strokeWidth="1.5"
        markerEnd="url(#truck-arrow)"
      />
      <rect
        x={cbx - 4}
        y={cby - 11}
        width={88}
        height={26}
        rx={6}
        fill="#0B1622"
        stroke="#F59E0B"
        strokeWidth="1.5"
      />
      <text
        x={cbx + 40}
        y={cby + 4}
        textAnchor="middle"
        fill="#F59E0B"
        fontSize="9.5"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        ↓ Recoger aqui
      </text>
    </g>
  );
}

export type { PalletSlot };
