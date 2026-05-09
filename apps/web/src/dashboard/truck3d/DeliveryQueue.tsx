/**
 * Cola de entregas estilo "Comandas" del mockup del usuario.
 *
 *   Parada #02
 *   09:40
 *   Bar Pepe
 *   C/ Valencia, 150
 *
 *   CAJAS A RECOGER
 *     2 cajas Estrella Damm
 *     1 caja Agua Veri
 *
 *   Ubicacion: Palet P1                  [▶ Iniciar]
 *
 * Solo la parada activa se ve expandida; el resto colapsa con un chevron.
 * Al pulsar "Iniciar" se marca la parada como entregada (los items
 * desaparecen del camion) y avanzamos a la siguiente.
 */
import type { InputData, LoadPlan, RoutePlan } from "@damm/optimizer-load";
import { paletteFor } from "./productColors";
import styles from "./TruckView3D.module.css";

export type DeliveryQueueProps = {
  routePlan: RoutePlan;
  inputData: InputData;
  loadPlan: LoadPlan;
  currentStopId: string | null;
  deliveredStopIds: Set<string>;
  onSelectStop: (stopId: string) => void;
  onConfirmDelivery: (stopId: string) => void;
  /** Barra lateral: altura acotada, lista con scroll interno */
  compact?: boolean;
};

export function DeliveryQueue({
  routePlan,
  inputData,
  loadPlan,
  currentStopId,
  deliveredStopIds,
  onSelectStop,
  onConfirmDelivery,
  compact = false,
}: DeliveryQueueProps) {
  const sortedStops = [...routePlan.stops].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const stopsById = new Map(inputData.stops.map((s) => [s.id, s]));
  const ordersByStop = new Map<string, (typeof inputData.orders)[number]>();
  for (const o of inputData.orders) ordersByStop.set(o.stopId, o);

  // Mapa stopId → palets (slotIds) que contienen items de esa parada.
  const slotsByStop = new Map<string, string[]>();
  for (const slot of loadPlan.palletSlots) {
    for (const it of slot.items) {
      const arr = slotsByStop.get(it.stopId) ?? [];
      if (!arr.includes(slot.slotId)) arr.push(slot.slotId);
      slotsByStop.set(it.stopId, arr);
    }
  }

  return (
    <div
      className={
        compact ? `${styles.queue} ${styles.queueCompact}` : styles.queue
      }
    >
      <div className={styles.queueHeader}>
        <h3>Comandas</h3>
        <span>{sortedStops.length - deliveredStopIds.size} pendientes</span>
      </div>

      <div className={styles.queueList}>
        {sortedStops.map((rs) => {
          const stop = stopsById.get(rs.stopId);
          const isDone = deliveredStopIds.has(rs.stopId);
          const isCurrent = rs.stopId === currentStopId;
          const order = ordersByStop.get(rs.stopId);
          const slots = slotsByStop.get(rs.stopId) ?? [];

          return (
            <div
              key={rs.stopId}
              className={styles.queueCard}
              data-active={isCurrent}
              data-done={isDone}
              onClick={() => onSelectStop(rs.stopId)}
            >
              <div className={styles.queueCardHead}>
                <div>
                  <span className={styles.queueParada}>
                    Parada #{String(rs.sequence).padStart(2, "0")}
                  </span>
                  <strong>{rs.clientName ?? stop?.clientName ?? rs.stopId}</strong>
                  {stop?.address && (
                    <small>📍 {shortAddress(stop.address)}</small>
                  )}
                </div>
                <div className={styles.queueCardMeta}>
                  <span className={styles.queueEta}>🕓 {rs.arrivalEta ?? "-"}</span>
                  {isDone && <span className={styles.queueDone}>✓ Entregado</span>}
                </div>
              </div>

              {isCurrent && order && !isDone && (
                <>
                  <div className={styles.queueLabel}>Cajas a recoger</div>
                  <ul className={styles.queueItems}>
                    {order.items.slice(0, 6).map((it) => {
                      const palette = paletteFor(it.productId, it.name);
                      return (
                        <li key={it.productId}>
                          <i style={{ background: palette.swatch }} />
                          <span>
                            <strong>
                              {it.quantity} {it.unit.toLowerCase()}
                            </strong>{" "}
                            {shortName(it.name)}
                          </span>
                        </li>
                      );
                    })}
                    {order.items.length > 6 && (
                      <li className={styles.queueMore}>
                        +{order.items.length - 6} mas…
                      </li>
                    )}
                  </ul>

                  <div className={styles.queueFoot}>
                    <span className={styles.queueLoc}>
                      Ubicacion:
                      {slots.map((s) => (
                        <em key={s} className={styles.queueSlotChip}>
                          {s}
                        </em>
                      ))}
                    </span>
                    <button
                      type="button"
                      className={styles.queueStart}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmDelivery(rs.stopId);
                      }}
                    >
                      ▶ Iniciar
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function shortName(name: string): string {
  return name.replace(/\s+RET\.?\s*PP$/i, "").replace(/\s{2,}/g, " ").trim();
}

function shortAddress(addr: string): string {
  const idx = addr.indexOf(",");
  if (idx > 0) return addr.slice(0, idx + 5).trim();
  return addr.length > 32 ? `${addr.slice(0, 32)}…` : addr;
}
