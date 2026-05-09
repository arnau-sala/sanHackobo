/**
 * TruckStage = solo la zona del camion 3D (vista + resumen P1–P8).
 * Comandas y copiloto viven en la columna izquierda del Dashboard.
 */
import { useMemo } from "react";
import type { LoadPlan } from "@damm/optimizer-load";
import { TruckView3D, type ViewMode } from "./TruckView3D";
import { PalletPopup } from "./PalletPopup";
import { PalletSummaryRow } from "./PalletSummaryRow";
import { buildPalletStack, type PalletStackInfo } from "./buildPalletStack";
import styles from "./TruckView3D.module.css";

export type TruckStageProps = {
  loadPlan: LoadPlan;
  currentStopId: string | null;
  deliveredStopIds: Set<string>;
  selectedSlotId: string | null;
  viewMode: ViewMode;
  onSelectSlot: (slotId: string | null) => void;
  onChangeMode: (mode: ViewMode) => void;
};

export function TruckStage(props: TruckStageProps) {
  const {
    loadPlan,
    currentStopId,
    deliveredStopIds,
    selectedSlotId,
    viewMode,
    onSelectSlot,
    onChangeMode,
  } = props;

  // Stacks por palet — ya filtrados por entregas hechas. Se calculan una
  // vez y se comparten entre la SVG, el popup y el summary row.
  const stacks = useMemo(() => {
    const map = new Map<string, PalletStackInfo>();
    for (const slot of loadPlan.palletSlots) {
      const remaining = slot.items.filter(
        (it) => !deliveredStopIds.has(it.stopId),
      );
      map.set(
        slot.slotId,
        buildPalletStack(remaining, {
          reservedForReturnables: slot.accessPriority === "returnables",
        }),
      );
    }
    return map;
  }, [loadPlan, deliveredStopIds]);

  // slots que contienen items de la parada activa.
  const highlightedSlotIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentStopId) return set;
    for (const slot of loadPlan.palletSlots) {
      if (slot.items.some((it) => it.stopId === currentStopId)) {
        set.add(slot.slotId);
      }
    }
    return set;
  }, [loadPlan, currentStopId]);

  const selectedSlot = loadPlan.palletSlots.find(
    (s) => s.slotId === selectedSlotId,
  );
  const selectedStack = selectedSlotId ? stacks.get(selectedSlotId) : undefined;

  return (
    <div className={styles.truckOnlyRoot}>
      <div className={styles.truckColumn}>
        <div className={styles.stage}>
          <div className={styles.stageHeader}>
            <div className={styles.stageHeaderText}>
              <h3>Carga del camion</h3>
              <p>
                {loadPlan.palletSlots.length} palets · vehiculo {loadPlan.vehicleId} ·
                toca un palet para ver contenido
              </p>
            </div>
            <div className={styles.modeTabs} role="tablist">
              <button
                type="button"
                className={styles.modeTab}
                data-active={viewMode === "general"}
                onClick={() => onChangeMode("general")}
              >
                ① Vista general
              </button>
              <button
                type="button"
                className={styles.modeTab}
                data-active={viewMode === "next-stop"}
                onClick={() => onChangeMode("next-stop")}
              >
                ② Proxima parada
              </button>
            </div>
          </div>

          <div className={styles.svgWrap}>
            <TruckView3D
              loadPlan={loadPlan}
              deliveredStopIds={deliveredStopIds}
              currentStopId={currentStopId}
              selectedSlotId={selectedSlotId}
              onSelectSlot={onSelectSlot}
              viewMode={viewMode}
            />

            {selectedSlot && selectedStack && (
              <PalletPopup
                slot={selectedSlot}
                stack={selectedStack}
                onClose={() => onSelectSlot(null)}
              />
            )}
          </div>

          <PalletSummaryRow
            loadPlan={loadPlan}
            stacks={stacks}
            selectedSlotId={selectedSlotId}
            highlightedSlotIds={highlightedSlotIds}
            onSelect={onSelectSlot}
          />
        </div>
      </div>
    </div>
  );
}
