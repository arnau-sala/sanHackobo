/**
 * Visualizacion 3D isometrica del camion + 8 palets.
 *
 * Layout fijo (4×2): col 0 = bloque A (cab), col 3 = bloque D (rear),
 * row 0 = lateral derecho (visible), row 1 = lateral izquierdo (interior).
 *
 * Modos:
 *   - viewMode="general"     todos los palets visibles
 *   - viewMode="next-stop"   solo el palet activo en color, el resto en
 *                            blanco translucido
 *
 * El componente es totalmente controlado: recibe `selectedSlotId` y
 * `currentStopId` y emite eventos `onSelectSlot`. El estado de "items
 * entregados" se calcula a partir de `deliveredStopIds`.
 */
import { useMemo } from "react";
import type { LoadPlan, PalletSlot } from "@damm/optimizer-load";
import { Pallet3D } from "./Pallet3D";
import { DEFAULT_GEOMETRY } from "./palletGeometry";
import { TruckShell } from "./TruckShell";
import { buildPalletStack } from "./buildPalletStack";
import { depthKey, project, type World } from "./projection";
import styles from "./TruckView3D.module.css";

export type ViewMode = "general" | "next-stop";

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

/**
 * Mapeo slotId → posicion en grid (col, row). Esto matchea el mockup del
 * usuario: P1..P4 lateral derecho (row 0), P5..P8 lateral izquierdo
 * (row 1), y dentro de cada lateral van de cabina a trasera.
 *
 * Se cae con gracia: si llega un slotId raro, va al final.
 */
const SLOT_GRID: Record<string, { col: number; row: number }> = {
  P1: { col: 0, row: 0 },
  P2: { col: 1, row: 0 },
  P3: { col: 2, row: 0 },
  P4: { col: 3, row: 0 },
  P5: { col: 0, row: 1 },
  P6: { col: 1, row: 1 },
  P7: { col: 2, row: 1 },
  P8: { col: 3, row: 1 },
};

const PALLET_GAP_X = 12; // separacion horizontal entre palets
const PALLET_GAP_Y = 8;
const TRUCK_PADDING = 16;

export function TruckView3D({
  loadPlan,
  deliveredStopIds,
  currentStopId,
  selectedSlotId,
  onSelectSlot,
  viewMode = "general",
}: TruckView3DProps) {
  // 1. Calcular boxes por palet (filtrando entregas ya hechas).
  const palletData = useMemo(() => {
    return loadPlan.palletSlots.map((slot) => {
      const remainingItems = slot.items.filter(
        (it) => !deliveredStopIds.has(it.stopId),
      );
      const stack = buildPalletStack(remainingItems, {
        reservedForReturnables: slot.accessPriority === "returnables",
      });
      return { slot, stack };
    });
  }, [loadPlan, deliveredStopIds]);

  // 2. Calcular qué palets contienen la entrega activa (highlightedSlots).
  const highlightedSlotIds = useMemo(() => {
    if (!currentStopId) return new Set<string>();
    const set = new Set<string>();
    for (const { slot } of palletData) {
      if (slot.items.some((it) => it.stopId === currentStopId)) {
        set.add(slot.slotId);
      }
    }
    return set;
  }, [palletData, currentStopId]);

  // 3. Geometria global: 4×2 palets con padding.
  const geo = DEFAULT_GEOMETRY;
  const cargoOrigin: World = { x: 0, y: 0, z: 0 };
  const cargoWidth = 4 * geo.width + 3 * PALLET_GAP_X + TRUCK_PADDING * 2;
  const cargoDepth = 2 * geo.depth + PALLET_GAP_Y + TRUCK_PADDING * 2;
  const cargoHeight = geo.baseHeight + 4 * geo.boxHeight + 18;

  // Posicion de cada palet.
  const placedPallets = palletData
    .map(({ slot, stack }) => {
      const grid = SLOT_GRID[slot.slotId] ?? { col: 0, row: 0 };
      const origin: World = {
        x: TRUCK_PADDING + grid.col * (geo.width + PALLET_GAP_X),
        y: TRUCK_PADDING + grid.row * (geo.depth + PALLET_GAP_Y),
        z: 0,
      };
      return { slot, stack, origin };
    })
    // ordenar por depthKey: pintamos los de atras (mayor y) primero.
    // Truco: usamos la esquina mas alejada del viewer.
    .sort((a, b) => {
      const da = depthKey({
        x: a.origin.x,
        y: a.origin.y + geo.depth,
        z: 0,
      });
      const db = depthKey({
        x: b.origin.x,
        y: b.origin.y + geo.depth,
        z: 0,
      });
      return da - db;
    });

  // 4. Calcular viewBox proyectando esquinas extremas. Tomamos las 8
  //    esquinas del bounding box (cargo + cabina) + un margen extra en
  //    arriba/derecha para que la bandera "Recoger aqui" no se corte.
  const totalW = cargoWidth + 90; // + cabina
  const corners: World[] = [
    { x: 0, y: 0, z: 0 },
    { x: totalW, y: 0, z: 0 },
    { x: 0, y: cargoDepth, z: 0 },
    { x: totalW, y: cargoDepth, z: 0 },
    { x: 0, y: 0, z: cargoHeight },
    { x: totalW, y: 0, z: cargoHeight },
    { x: 0, y: cargoDepth, z: cargoHeight },
    { x: totalW, y: cargoDepth, z: cargoHeight },
  ];
  const projected = corners.map(project);
  const minX = Math.min(...projected.map((p) => p.x)) - 30;
  const maxX = Math.max(...projected.map((p) => p.x)) + 130; // banderita
  const minY = Math.min(...projected.map((p) => p.y)) - 60; // texto bandera
  const maxY = Math.max(...projected.map((p) => p.y)) + 30;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <svg
      className={styles.svg}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: `${vbW} / ${vbH}` }}
      onClick={() => onSelectSlot?.(null)}
    >
      <defs>
        <filter id="truck-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#truck-shadow)">
        <TruckShell
          origin={cargoOrigin}
          width={cargoWidth}
          depth={cargoDepth}
          height={cargoHeight}
        />

        {placedPallets.map(({ slot, stack, origin }) => {
          const isHighlighted =
            viewMode === "next-stop" && highlightedSlotIds.has(slot.slotId);
          const isGhosted =
            viewMode === "next-stop" && !highlightedSlotIds.has(slot.slotId);
          return (
            <Pallet3D
              key={slot.slotId}
              origin={origin}
              boxes={stack.boxes}
              slotId={slot.slotId}
              selected={selectedSlotId === slot.slotId}
              highlighted={isHighlighted}
              ghosted={isGhosted}
              highlightStopId={
                viewMode === "next-stop" ? currentStopId ?? null : null
              }
              onSelect={(slotId) => {
                onSelectSlot?.(slotId);
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}

export type { PalletSlot };
