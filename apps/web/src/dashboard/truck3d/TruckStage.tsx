/**
 * TruckStage = panel del camion 3D + strip de resumen P1..P8.
 *
 * Al seleccionar un palet, el detalle se muestra en una columna HTML a la
 * derecha del SVG (el camion queda solo en la zona izquierda del stage).
 *
 * Comandas y copilot viven en la columna izquierda del Dashboard.
 */
import { useMemo } from "react";
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import { TruckView3D, type ViewMode } from "./TruckView3D";
import { TruckDetailTabs } from "./TruckDetailTabs";
import { buildPalletStack, type PalletStackInfo } from "./buildPalletStack";
import { buildRenderPallet } from "./palletRenderModel";
import styles from "./TruckView3D.module.css";

export type TruckStageProps = {
  loadPlan: LoadPlan;
  routePlan: RoutePlan;
  inputData: InputData;
  currentStopId: string | null;
  deliveredStopIds: Set<string>;
  selectedSlotId: string | null;
  viewMode: ViewMode;
  onSelectSlot: (slotId: string | null) => void;
  onChangeMode: (mode: ViewMode) => void;
  detailTab?: "palets" | "deliveries";
  detailItem?: string | null;
  onDetailTabChange?: (tab: "palets" | "deliveries") => void;
  onDetailItemChange?: (item: string | null) => void;
};

export function TruckStage(props: TruckStageProps) {
  const {
    loadPlan,
    routePlan,
    inputData,
    currentStopId,
    deliveredStopIds,
    selectedSlotId,
    viewMode,
    onSelectSlot,
    detailTab = "palets",
    detailItem = null,
    onDetailTabChange,
    onDetailItemChange,
  } = props;

  function handleDetailItemSelect(item: string | null) {
    if (!item) {
      onSelectSlot(null);
      onDetailItemChange?.(null);
      return;
    }

    if (detailTab === "palets") {
      onSelectSlot(item);
      onDetailTabChange?.("palets");
    } else {
      onSelectSlot(null);
    }

    onDetailItemChange?.(item);
  }

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

  const selectedSlot = useMemo(() => {
    if (!selectedSlotId) return null;
    return loadPlan.palletSlots.find((s) => s.slotId === selectedSlotId) ?? null;
  }, [loadPlan, selectedSlotId]);

  const selectedRender = useMemo(() => {
    if (!selectedSlot) return null;
    const idx = loadPlan.palletSlots
      .slice(0, 8)
      .findIndex((s) => s.slotId === selectedSlot.slotId);
    if (idx < 0) return null;
    return buildRenderPallet(selectedSlot, { index: idx, deliveredStopIds });
  }, [selectedSlot, loadPlan, deliveredStopIds]);

  // Compute renders map for all slots
  const renders = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildRenderPallet>>();
    for (let i = 0; i < Math.min(loadPlan.palletSlots.length, 8); i++) {
      const slot = loadPlan.palletSlots[i];
      const render = buildRenderPallet(slot, { index: i, deliveredStopIds });
      map.set(slot.slotId, render);
    }
    return map;
  }, [loadPlan, deliveredStopIds]);

  const selectedStack =
    selectedSlotId != null ? stacks.get(selectedSlotId) : undefined;

  return (
    <div className={styles.truckOnlyRoot}>
      <div className={styles.truckColumn}>
        <div className={styles.stage}>
          <div className={styles.truckDetailSplit}>
            <div className={styles.truckSvgZone}>
              <div className={styles.svgWrap}>
                <TruckView3D
                  loadPlan={loadPlan}
                  deliveredStopIds={deliveredStopIds}
                  currentStopId={currentStopId}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={(slotId) => {
                    onSelectSlot(slotId);
                    if (slotId && onDetailItemChange && onDetailTabChange) {
                      onDetailTabChange("palets");
                      onDetailItemChange(slotId);
                    }
                  }}
                  viewMode={viewMode}
                />
              </div>
            </div>
            <div className={styles.detailPanel}>
              <TruckDetailTabs
                tab={detailTab}
                selectedItem={detailItem}
                loadPlan={loadPlan}
                routePlan={routePlan}
                inputData={inputData}
                deliveredStopIds={deliveredStopIds}
                stacks={stacks}
                renders={renders}
                onTabChange={onDetailTabChange || (() => {})}
                onItemSelect={handleDetailItemSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
