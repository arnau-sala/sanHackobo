import type { LoadedItem, PalletSlot } from "./types";
import styles from "./TruckLoadView.module.css";

interface SlotCardProps {
  slot: PalletSlot;
  selected: boolean;
  highlighted: boolean;
  onSelect: (slotId: string) => void;
}

/**
 * Renderiza un palet completo en perspectiva lateral:
 *   - cajas / barriles / botellas apilados por capa (bottom -> middle -> top)
 *   - base de palet de madera
 *   - etiqueta con slotId, bloque de ruta y fill ratio
 *
 * Si `highlighted` es true, el palet se ilumina en amarillo (modo descarga).
 */
export function SlotCard({
  slot,
  selected,
  highlighted,
  onSelect,
}: SlotCardProps) {
  const fill = clamp01(slot.fillRatio ?? 0);
  const fillPct = Math.round(fill * 100);
  const overflow = (slot.fillRatio ?? 0) > 1;
  const isReturnables = slot.accessPriority === "returnables";

  // Agrupamos los items por capa lógica para apilarlos visualmente.
  const top = slot.items.filter((i) => i.layer === "top");
  const middle = slot.items.filter((i) => i.layer === "middle");
  const bottom = slot.items.filter((i) => i.layer === "bottom");

  return (
    <button
      type="button"
      className={styles.pallet}
      data-priority={slot.accessPriority}
      data-selected={selected}
      data-highlighted={highlighted}
      onClick={() => onSelect(slot.slotId)}
      aria-label={`Palet ${slot.slotId}, ${fillPct}% lleno, ${slot.items.length} productos`}
    >
      <div className={styles.deliveryFlag}>↓ Descargar aquí</div>

      <div className={styles.palletStack}>
        {slot.items.length === 0 ? (
          <div className={styles.palletEmpty}>
            {isReturnables
              ? "Reservado para retornables y envases"
              : "Vacío"}
          </div>
        ) : (
          <>
            {top.length > 0 && (
              <div className={styles.layer}>
                {top.map((item, i) => (
                  <BoxBlock
                    key={`top-${i}`}
                    item={item}
                    layer="top"
                  />
                ))}
              </div>
            )}
            {middle.length > 0 && (
              <div className={styles.layer}>
                {middle.map((item, i) => (
                  <BoxBlock
                    key={`mid-${i}`}
                    item={item}
                    layer="middle"
                  />
                ))}
              </div>
            )}
            {bottom.length > 0 && (
              <div className={styles.layer}>
                {bottom.map((item, i) => (
                  <BoxBlock
                    key={`bot-${i}`}
                    item={item}
                    layer="bottom"
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.palletBase} aria-hidden="true" />

      <div
        className={styles.palletLabel}
        data-priority={slot.accessPriority}
      >
        <span>
          {slot.slotId}
          {slot.routeBlock && (
            <span className={styles.palletBadge}>
              {prettyBlock(slot.routeBlock)}
            </span>
          )}
        </span>
        <small>{fillPct}%</small>
      </div>

      <div className={styles.fillBar} data-overflow={overflow}>
        <div
          className={styles.fillBarInner}
          style={{ width: `${Math.min(100, fill * 100).toFixed(0)}%` }}
        />
      </div>
    </button>
  );
}

/** Bloque visual de una caja/barril/botella concreta. */
function BoxBlock({
  item,
  layer,
}: {
  item: LoadedItem;
  layer: "bottom" | "middle" | "top";
}) {
  // Tamaño base por capa: bottom = más grande (kegs, cajas pesadas),
  // middle = mediano, top = pequeño.
  const baseHeight =
    layer === "bottom" ? 30 : layer === "middle" ? 22 : 16;

  // Anchura que crece logarítmicamente con la cantidad para que se note
  // sin acaparar el palet entero.
  const widthBase =
    item.handlingType === "keg"
      ? 26
      : item.handlingType === "crate"
        ? 32
        : item.handlingType === "bottle"
          ? 18
          : 28;
  const widthBoost = Math.min(22, Math.log2(item.quantity + 1) * 3.4);

  // Kegs ligeramente más altos para sugerir cilindro.
  const height =
    item.handlingType === "keg" ? baseHeight + 4 : baseHeight;

  return (
    <div
      className={styles.box}
      data-type={item.handlingType}
      style={{
        width: `${widthBase + widthBoost}px`,
        height: `${height}px`,
      }}
      title={`${item.quantity}× ${item.unit} ${item.name} — ${item.clientName} (sec.${item.sequence})`}
    >
      <span className={styles.boxLabel}>
        {item.productId.length > 5
          ? item.productId.slice(0, 5)
          : item.productId}
      </span>
      {item.returnable && (
        <span className={styles.returnableBadge}>♻</span>
      )}
    </div>
  );
}

function prettyBlock(id: string): string {
  return id
    .split("+")
    .map((part) => part.replace(/^block-/, ""))
    .join("+");
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
