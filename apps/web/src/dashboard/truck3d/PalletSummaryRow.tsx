/**
 * Strip horizontal con 8 cards (P1..P8). Cada card:
 *   - id del palet en color de la categoria (Cajas / Mixto / Barriles / Retornables)
 *   - count "16/60 cajas" o "4/20 barriles"
 *   - barra de progreso en color de la categoria
 *   - categoria + rango de paradas
 *
 * Click en una card → mismo selectedSlotId que en el truck.
 */
import type { LoadPlan } from "@damm/optimizer-load";
import type { PalletStackInfo } from "./buildPalletStack";
import { ACCENT_BY_TYPE } from "./figmaBrands";
import styles from "./TruckView3D.module.css";

export type PalletSummaryRowProps = {
  loadPlan: LoadPlan;
  stacks: Map<string, PalletStackInfo>;
  selectedSlotId?: string | null;
  highlightedSlotIds?: Set<string>;
  onSelect?: (slotId: string) => void;
};

export function PalletSummaryRow({
  loadPlan,
  stacks,
  selectedSlotId,
  highlightedSlotIds,
  onSelect,
}: PalletSummaryRowProps) {
  return (
    <div className={styles.summaryRow}>
      {loadPlan.palletSlots.slice(0, 8).map((slot) => {
        const stack = stacks.get(slot.slotId);
        const isReturn = slot.accessPriority === "returnables";
        const category = stack?.category ?? (isReturn ? "Retornables" : "Vacio");
        const color = ACCENT_BY_TYPE[category] ?? "#94A3B8";

        const totalQty = stack?.totalCount ?? 0;
        const cap = guessCapacity(slot, stack);
        const fillPct = cap > 0 ? Math.min(100, (totalQty / cap) * 100) : 0;

        const unitWord = category === "Barriles" ? "barriles" : "cajas";
        const isSelected = selectedSlotId === slot.slotId;
        const isHighlighted = highlightedSlotIds?.has(slot.slotId);

        return (
          <button
            key={slot.slotId}
            type="button"
            className={styles.summaryCard}
            data-selected={isSelected}
            data-highlighted={isHighlighted}
            onClick={() => onSelect?.(slot.slotId)}
            title={`${slot.slotId} · ${category}`}
            style={{
              borderColor: `${color}55`,
            }}
          >
            <div className={styles.summaryHead}>
              <span
                className={styles.summarySlot}
                style={{ color }}
              >
                {slot.slotId}
              </span>
              <span className={styles.summaryCount}>
                {totalQty}/{cap} {unitWord}
              </span>
            </div>
            <div className={styles.summaryBar}>
              <div
                style={{
                  width: `${fillPct}%`,
                  background: color,
                }}
              />
            </div>
            <div className={styles.summaryMeta}>
              <strong>{category}</strong>
              <span>
                {slot.sequenceRange
                  ? `Paradas ${slot.sequenceRange.from}-${slot.sequenceRange.to}`
                  : isReturn
                    ? "Reservado"
                    : "—"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function guessCapacity(
  slot: { accessPriority: string; capacityVolume?: number },
  stack: PalletStackInfo | undefined,
): number {
  if (!stack) return 60;
  if (stack.category === "Barriles") return 20;
  if (slot.accessPriority === "returnables") return 60;
  return 60;
}
