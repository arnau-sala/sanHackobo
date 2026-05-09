/**
 * Lista de paradas + clusters + meta del RoutePlan.
 *
 *   - Resalta la parada actual (highlight dinamico).
 *   - Marca las paradas previas como completadas.
 *   - Hover/click selecciona la parada y propaga al resto del dashboard.
 *
 * Recicla el contrato `RoutePlan` y `InputData` del optimizador.
 */
import { useMemo } from "react";
import type { InputData, RoutePlan } from "@damm/optimizer-load";
import styles from "./Dashboard.module.css";

interface RoutePanelProps {
  routePlan: RoutePlan;
  inputData: InputData;
  currentStopId: string;
  onSelectStop: (stopId: string) => void;
}

export function RoutePanel({
  routePlan,
  inputData,
  currentStopId,
  onSelectStop,
}: RoutePanelProps) {
  const sortedStops = useMemo(
    () => [...routePlan.stops].sort((a, b) => a.sequence - b.sequence),
    [routePlan],
  );

  const stopById = useMemo(
    () => new Map(inputData.stops.map((s) => [s.id, s])),
    [inputData],
  );

  const currentSeq = useMemo(() => {
    const cur = sortedStops.find((s) => s.stopId === currentStopId);
    return cur?.sequence ?? 0;
  }, [sortedStops, currentStopId]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>Ruta DR0027</h3>
        <span>{routePlan.id}</span>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.routeMeta}>
          <div className={styles.routeMetaCard}>
            <span>Paradas</span>
            <strong>{routePlan.totalStops}</strong>
          </div>
          <div className={styles.routeMetaCard}>
            <span>Km est.</span>
            <strong>{routePlan.estimatedKm ?? "-"}</strong>
          </div>
          <div className={styles.routeMetaCard}>
            <span>Min est.</span>
            <strong>{routePlan.estimatedMinutes ?? "-"}</strong>
          </div>
        </div>

        <div className={styles.routeStops}>
          {sortedStops.map((rs) => {
            const stop = stopById.get(rs.stopId);
            const isActive = rs.stopId === currentStopId;
            const isDone = rs.sequence < currentSeq;
            return (
              <button
                key={rs.stopId}
                type="button"
                className={styles.routeStop}
                data-active={isActive}
                data-done={isDone}
                onClick={() => onSelectStop(rs.stopId)}
              >
                <span className={styles.seq}>{rs.sequence}</span>
                <span className={styles.stopBody}>
                  <span className={styles.stopName}>
                    {rs.clientName ?? stop?.clientName ?? rs.stopId}
                  </span>
                  <span className={styles.stopMeta}>
                    {rs.arrivalEta ? `${rs.arrivalEta} · ` : ""}
                    {stop?.zone ?? "-"}
                    {stop?.timeWindow
                      ? ` · ${stop.timeWindow.from}-${stop.timeWindow.to}`
                      : ""}
                  </span>
                </span>
                {rs.clusterId && (
                  <span className={styles.stopBadge}>
                    {prettyCluster(rs.clusterId)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function prettyCluster(clusterId: string): string {
  return clusterId.replace(/^cluster-/, "C·");
}
