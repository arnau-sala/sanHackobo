/**
 * TruckStage = panel del camion 3D + strip de resumen P1..P8.
 *
 * El popup vive ahora DENTRO del SVG (`<foreignObject>` en TruckView3D),
 * asi cuando el SVG se redimensiona el popup sigue pegado al palet sin
 * tener que sincronizar coordenadas DOM ↔ SVG.
 *
 * Comandas y copilot viven en la columna izquierda del Dashboard.
 */
import { useMemo } from "react";
import type { LoadPlan } from "@damm/optimizer-load";
import { TruckView3D, type ViewMode } from "./TruckView3D";
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

  // Stacks por palet (filtrados por entregas hechas) — los reutiliza el
  // resumen P1..P8 inferior y el popup.
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
  }, [loadPlan, currentStopId, deliveredStopIds]);

  return (
    <div className={styles.truckOnlyRoot}>
      <div className={styles.truckColumn}>
        <div className={styles.stage}>
          <div className={styles.stageHeader}>
            <div className={styles.stageHeaderText}>
              <span className={styles.stageBadge} />
              <h3>Carga del camion</h3>
              <span className={styles.stagePill}>
                {loadPlan.palletSlots.length} palets · {loadPlan.vehicleId}
              </span>
            </div>
            <div className={styles.stageHints}>
              <span className={styles.stageHint}>
                ⓘ Toca un palet para ver contenido
              </span>
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
