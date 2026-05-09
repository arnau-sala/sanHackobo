import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LoadPlan, PalletSlot } from "./types";
import { SlotCard } from "./SlotCard";
import { SlotDetailsDrawer } from "./SlotDetailsDrawer";
import styles from "./TruckLoadView.module.css";

export interface TruckLoadViewProps {
  /** Resultado de optimizeLoad(inputData, routePlan). */
  loadPlan: LoadPlan;
  /** Slot seleccionado al montar (default: primero de la lista). */
  initialSelectedSlotId?: string;
  /** Callback cuando el usuario clica un palet. */
  onSlotSelect?: (slotId: string) => void;
  /**
   * Slots que deben aparecer "iluminados" porque ahora mismo se está
   * descargando algo en ellos. Se combina con `highlightedStopId`.
   */
  highlightedSlotIds?: string[];
  /**
   * Si se pasa un stopId, todos los slots cuyos items pertenezcan a esa
   * parada se iluminarán automáticamente.
   */
  highlightedStopId?: string;
  /** Título del header. */
  title?: string;
}

/**
 * Vista 2D estática del maletero por palets.
 *
 * Se elimina deliberadamente la perspectiva 3D para facilitar integración
 * con la rama de diseño/3D del equipo. Mantiene:
 *   - agrupación en dos filas (lado visible / lado interior),
 *   - selección de palet,
 *   - highlight de descarga por parada,
 *   - drawer con detalle.
 */
export function TruckLoadView({
  loadPlan,
  initialSelectedSlotId,
  onSlotSelect,
  highlightedSlotIds,
  highlightedStopId,
  title = "Damm Smart Truck Copilot",
}: TruckLoadViewProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    initialSelectedSlotId ?? loadPlan.palletSlots[0]?.slotId ?? null,
  );

  // ----- Lista de paradas (ordenadas por sequence) -----
  const allStops = useMemo(() => {
    const map = new Map<
      string,
      { stopId: string; sequence: number; clientName: string }
    >();
    for (const slot of loadPlan.palletSlots) {
      for (const item of slot.items) {
        if (!map.has(item.stopId)) {
          map.set(item.stopId, {
            stopId: item.stopId,
            sequence: item.sequence,
            clientName: item.clientName,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);
  }, [loadPlan]);

  // ----- Modo simulación de descarga -----
  const [demoStopIndex, setDemoStopIndex] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!autoplay) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setDemoStopIndex((prev) => {
        if (prev === null) return 0;
        if (prev >= allStops.length - 1) {
          setAutoplay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1800);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoplay, allStops.length]);

  const currentDemoStop =
    demoStopIndex !== null ? allStops[demoStopIndex] : null;

  // Cuando avanzamos la simulación, también seleccionamos el palet
  // correspondiente para que el drawer derecho se actualice automáticamente.
  useEffect(() => {
    if (!currentDemoStop) return;
    const slot = loadPlan.palletSlots.find((s) =>
      s.items.some((i) => i.stopId === currentDemoStop.stopId),
    );
    if (slot) {
      setSelectedSlotId(slot.slotId);
      onSlotSelect?.(slot.slotId);
    }
  }, [currentDemoStop, loadPlan, onSlotSelect]);

  // ----- Set efectivo de slots iluminados -----
  const effectiveHighlight = useMemo(() => {
    const set = new Set<string>(highlightedSlotIds ?? []);

    const stopId =
      currentDemoStop?.stopId ?? highlightedStopId ?? null;
    if (stopId) {
      for (const s of loadPlan.palletSlots) {
        if (s.items.some((i) => i.stopId === stopId)) {
          set.add(s.slotId);
        }
      }
    }
    return set;
  }, [
    highlightedSlotIds,
    currentDemoStop,
    highlightedStopId,
    loadPlan,
  ]);

  // ----- Handlers -----
  const handleSelect = useCallback(
    (slotId: string) => {
      setSelectedSlotId(slotId);
      onSlotSelect?.(slotId);
    },
    [onSlotSelect],
  );

  const selectedSlot = useMemo(
    () =>
      loadPlan.palletSlots.find((s) => s.slotId === selectedSlotId) ?? null,
    [loadPlan, selectedSlotId],
  );

  // Layout 2D por filas:
  // Fila visible (lateral abierto): P1, P2, P5, P7
  // Fila interior (lado opuesto):   P3, P4, P6, P8
  const FRONT_ORDER = ["P1", "P2", "P5", "P7"];
  const BACK_ORDER = ["P3", "P4", "P6", "P8"];

  const slotsById = new Map(
    loadPlan.palletSlots.map((s) => [s.slotId, s] as const),
  );
  const frontPallets = FRONT_ORDER.map((id) => slotsById.get(id)).filter(
    (s): s is PalletSlot => !!s,
  );
  const backPallets = BACK_ORDER.map((id) => slotsById.get(id)).filter(
    (s): s is PalletSlot => !!s,
  );

  // Si el vehículo no es de 8 palets, renderizamos lo que venga en una sola fila.
  const isStandardLayout =
    frontPallets.length === 4 && backPallets.length === 4;
  const fallbackPallets = isStandardLayout ? [] : loadPlan.palletSlots;

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>
          {title}
          <small>
            Vehículo {loadPlan.vehicleId} · {loadPlan.strategy}
          </small>
        </h2>
        <div className={styles.kpis}>
          <Kpi label="Ocupación" value={pct(loadPlan.kpis.truckFillRatio)} />
          <Kpi
            label="Alineación ruta"
            value={pct(loadPlan.kpis.routeAlignmentScore)}
          />
          <Kpi
            label="Pesados abajo"
            value={pct(loadPlan.kpis.heavyItemsBottomRatio)}
          />
          <Kpi
            label="Acceso directo"
            value={pct(loadPlan.kpis.stopsWithDirectAccessRatio)}
          />
          <Kpi
            label="Picking"
            value={pct(loadPlan.kpis.estimatedPickingComplexity)}
            hint="bajo = simple"
          />
          <Kpi
            label="Descarga"
            value={pct(loadPlan.kpis.estimatedUnloadingComplexity)}
            hint="bajo = simple"
          />
          <Kpi
            label="Retornables"
            value={pct(loadPlan.kpis.returnablesReadinessScore)}
          />
        </div>
      </header>

      <section className={styles.scene}>
        {/* Toolbar de simulación de descarga */}
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>
            {currentDemoStop ? (
              <>
                <strong>
                  Parada {currentDemoStop.sequence}
                </strong>
                Descargando en {currentDemoStop.clientName} —{" "}
                {effectiveHighlight.size} palet
                {effectiveHighlight.size === 1 ? "" : "s"} iluminado
                {effectiveHighlight.size === 1 ? "" : "s"}.
              </>
            ) : (
              <>
                <strong>Modo descarga</strong>
                Pulsa <em>Iniciar</em> para simular el recorrido y ver qué
                palet hay que abrir en cada parada.
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() =>
              setDemoStopIndex((p) =>
                p === null ? null : Math.max(0, p - 1),
              )
            }
            disabled={demoStopIndex === null || demoStopIndex === 0}
          >
            ◀ Anterior
          </button>
          <button
            type="button"
            data-active={autoplay}
            onClick={() => {
              if (demoStopIndex === null) setDemoStopIndex(0);
              setAutoplay((p) => !p);
            }}
          >
            {autoplay ? "❚❚ Pausa" : demoStopIndex === null ? "▶ Iniciar" : "▶ Auto"}
          </button>
          <button
            type="button"
            onClick={() =>
              setDemoStopIndex((p) =>
                p === null
                  ? 0
                  : Math.min(allStops.length - 1, p + 1),
              )
            }
            disabled={
              demoStopIndex !== null && demoStopIndex >= allStops.length - 1
            }
          >
            Siguiente ▶
          </button>
          <button
            type="button"
            onClick={() => {
              setAutoplay(false);
              setDemoStopIndex(null);
            }}
          >
            ↺ Reset
          </button>
        </div>

        <div className={styles.truckFlat}>
          {isStandardLayout ? (
            <div className={styles.palletRows}>
              <div className={styles.rowTitle}>Lado interior</div>
              <div className={`${styles.row} ${styles.rowBack}`}>
                {backPallets.map((slot) => (
                  <SlotCard
                    key={slot.slotId}
                    slot={slot}
                    selected={slot.slotId === selectedSlotId}
                    highlighted={effectiveHighlight.has(slot.slotId)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>

              <div className={styles.rowTitle}>Lado abierto (acceso)</div>
              <div className={`${styles.row} ${styles.rowFront}`}>
                {frontPallets.map((slot) => (
                  <SlotCard
                    key={slot.slotId}
                    slot={slot}
                    selected={slot.slotId === selectedSlotId}
                    highlighted={effectiveHighlight.has(slot.slotId)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.palletRows}>
              <div className={styles.rowTitle}>Palets del vehículo</div>
              <div className={`${styles.row} ${styles.rowFront}`}>
                {fallbackPallets.map((slot) => (
                  <SlotCard
                    key={slot.slotId}
                    slot={slot}
                    selected={slot.slotId === selectedSlotId}
                    highlighted={effectiveHighlight.has(slot.slotId)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <SlotDetailsDrawer slot={selectedSlot} warnings={loadPlan.warnings} />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.kpi}>
      <span>{label}</span>
      <span>
        {value}
        {hint && (
          <small style={{ marginLeft: 4, color: "#94a3b8", fontSize: 9 }}>
            {hint}
          </small>
        )}
      </span>
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default TruckLoadView;
