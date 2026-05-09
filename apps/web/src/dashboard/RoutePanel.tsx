/**
 * Lista de paradas + clusters + meta del RoutePlan.
 *
 *   - Resalta la parada actual (highlight dinamico).
 *   - Marca las paradas previas como completadas.
 *   - AUTO-SCROLL: al cambiar la parada activa, la lista hace scroll
 *     suave para que siempre esté visible sin tocar la pantalla.
 *
 * Recicla el contrato `RoutePlan` y `InputData` del optimizador.
 */
import { useEffect, useMemo, useRef } from "react";
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
  const stopsRef = useRef<HTMLDivElement>(null);

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

  // AUTO-SCROLL: cuando cambia la parada activa, centrar en la lista
  useEffect(() => {
    if (!currentStopId || !stopsRef.current) return;
    const timer = setTimeout(() => {
      const btn = stopsRef.current?.querySelector(
        `[data-stop-id="${currentStopId}"]`,
      ) as HTMLElement | null;
      if (btn) {
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currentStopId]);

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

        <div className={styles.routeStops} ref={stopsRef}>
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
                data-stop-id={rs.stopId}
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
