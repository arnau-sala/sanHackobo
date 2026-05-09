import type { LoadWarning, PalletSlot } from "./types";
import styles from "./TruckLoadView.module.css";

interface SlotDetailsDrawerProps {
  slot: PalletSlot | null;
  warnings: LoadWarning[];
}

/**
 * Panel lateral con el detalle completo del slot seleccionado:
 *   - capacidad y fill
 *   - lista completa de items con cliente, secuencia, layer, motivo
 *   - warnings asociados
 */
export function SlotDetailsDrawer({ slot, warnings }: SlotDetailsDrawerProps) {
  if (!slot) {
    return (
      <aside className={styles.drawer}>
        <p className={styles.drawerEmpty}>
          Selecciona un palet para ver los productos, los clientes, la
          secuencia de paradas y los warnings asociados.
        </p>
        <Legend />
      </aside>
    );
  }

  const fill = ((slot.fillRatio ?? 0) * 100).toFixed(0);
  const slotWarnings = warnings.filter(
    (w) => w.relatedSlotId === slot.slotId,
  );
  const itemsBySequence = [...slot.items].sort(
    (a, b) => a.sequence - b.sequence,
  );

  return (
    <aside className={styles.drawer}>
      <div className={styles.drawerHeader}>
        <h3>{slot.slotId}</h3>
        <span>
          {slot.side} · {slot.accessPriority}
          {slot.routeBlock ? ` · ${slot.routeBlock}` : ""}
        </span>
      </div>

      <div className={styles.drawerStats}>
        <div className={styles.drawerStat}>
          <span>Fill ratio</span>
          <span>{fill}%</span>
        </div>
        <div className={styles.drawerStat}>
          <span>Items</span>
          <span>{slot.items.length}</span>
        </div>
        <div className={styles.drawerStat}>
          <span>Volumen</span>
          <span>
            {(slot.usedVolume ?? 0).toFixed(2)} / {(slot.capacityVolume ?? 0).toFixed(2)} m³
          </span>
        </div>
        <div className={styles.drawerStat}>
          <span>Peso</span>
          <span>
            {(slot.usedWeight ?? 0).toFixed(0)} / {(slot.capacityWeight ?? 0).toFixed(0)} kg
          </span>
        </div>
      </div>

      {slot.sequenceRange && (
        <div style={{ fontSize: 12, color: "#cbd5e1" }}>
          Asociado a paradas <strong>{slot.sequenceRange.from}</strong> a{" "}
          <strong>{slot.sequenceRange.to}</strong>.
        </div>
      )}

      <h4 style={{ margin: "8px 0 0", fontSize: 13 }}>
        Productos ({slot.items.length})
      </h4>

      <div className={styles.itemList}>
        {itemsBySequence.length === 0 && (
          <span className={styles.drawerEmpty}>Slot vacío.</span>
        )}
        {itemsBySequence.map((it, idx) => (
          <div className={styles.itemRow} key={`${it.productId}-${idx}`}>
            <div className={styles.itemRowHeader}>
              <span className={styles.itemRowClient}>
                {it.clientName}
              </span>
              <span className={styles.itemRowSeq}>sec.{it.sequence}</span>
            </div>
            <div className={styles.itemRowName}>
              {it.quantity}× {it.unit} · {it.name}{" "}
              <span style={{ color: "#94a3b8" }}>({it.productId})</span>
            </div>
            <div className={styles.itemRowMeta}>
              <span>{it.handlingType}</span>
              <span>layer {it.layer}</span>
              <span>{it.accessSide}</span>
              {it.returnable && <span>♻ retornable</span>}
            </div>
            <div className={styles.itemRowReason}>{it.reason}</div>
          </div>
        ))}
      </div>

      <h4 style={{ margin: "8px 0 0", fontSize: 13 }}>
        Warnings de este slot ({slotWarnings.length})
      </h4>

      {slotWarnings.length === 0 ? (
        <div className={styles.drawerEmpty}>Sin warnings asociados.</div>
      ) : (
        <div className={styles.warningList}>
          {slotWarnings.map((w, idx) => (
            <div
              key={idx}
              className={styles.warningRow}
              data-severity={w.severity}
            >
              <div className={styles.warningType}>
                {w.severity} · {w.type}
              </div>
              <div>{w.message}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function Legend() {
  return (
    <div className={styles.legend}>
      <span>
        <span
          className={styles.legendDot}
          style={{ background: "var(--accent-high)" }}
        />
        High access
      </span>
      <span>
        <span
          className={styles.legendDot}
          style={{ background: "var(--accent-medium)" }}
        />
        Medium
      </span>
      <span>
        <span
          className={styles.legendDot}
          style={{ background: "var(--accent-low)" }}
        />
        Low
      </span>
      <span>
        <span
          className={styles.legendDot}
          style={{ background: "var(--accent-returnables)" }}
        />
        Retornables
      </span>
    </div>
  );
}
