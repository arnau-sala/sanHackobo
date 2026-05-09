/**
 * Strip horizontal con 8 cards (P1..P8). Cada card:
 *   - id del palet, fill ratio (X/Y cajas o barriles)
 *   - barra de progreso con el color dominante de la familia mas presente
 *   - categoria (Cajas / Barriles / Mixto / Retornables)
 *   - rango de paradas asignado (block A → "Paradas 1-4", etc.)
 *
 * Click en una card → mismo selectedSlotId que en el truck.
 */
import type { LoadPlan } from "@damm/optimizer-load";
import type { PalletStackInfo } from "./buildPalletStack";
import { PALETTES } from "./productColors";
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
      {loadPlan.palletSlots.map((slot) => {
        const stack = stacks.get(slot.slotId);
        const totalQty = stack?.totalCount ?? 0;
        const cap = guessCapacity(slot, stack);
        const fillPct = cap > 0 ? Math.min(100, (totalQty / cap) * 100) : 0;

        const dominant = topFamily(stack?.byFamily ?? {});
        const dominantPalette = PALETTES[dominant] ?? PALETTES.default;

        const isReturn = slot.accessPriority === "returnables";
        const unitWord = stack?.category === "Barriles" ? "barriles" : "cajas";
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
            title={`${slot.slotId} · ${stack?.category ?? "Vacio"}`}
          >
            <div className={styles.summaryHead}>
              <span className={styles.summarySlot}>{slot.slotId}</span>
              <span className={styles.summaryCount}>
                {totalQty}/{cap} {unitWord}
              </span>
            </div>
            <div
              className={styles.summaryBar}
              style={{
                background: "#e2e8f022",
              }}
            >
              <div
                style={{
                  width: `${fillPct}%`,
                  background: dominantPalette.swatch,
                }}
              />
            </div>
            <div className={styles.summaryMeta}>
              <strong>{stack?.category ?? (isReturn ? "Retornables" : "Vacio")}</strong>
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
  // Heuristica: 60 cajas o 20 barriles por palet, da numeros redondos
  // tipo "53/60 cj" como en el mockup del usuario.
  if (!stack) return 60;
  if (stack.category === "Barriles") return 20;
  if (slot.accessPriority === "returnables") return 60;
  return 60;
}

function topFamily(byFamily: Record<string, number>): string {
  let best = "default";
  let bestQty = -1;
  for (const [family, qty] of Object.entries(byFamily)) {
    if (qty > bestQty) {
      best = family;
      bestQty = qty;
    }
  }
  return best;
}
