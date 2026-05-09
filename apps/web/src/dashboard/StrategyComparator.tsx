/**
 * Compara el LoadPlan optimizado (hibrido por bloques de ruta) contra una
 * carga "tradicional" (un unico bloque, equivalente a cargar por almacen).
 *
 * Las dos versiones se generan llamando al mismo `optimizeLoad` con distintos
 * `blockSize`, asi que no duplicamos logica.
 */
import { useMemo } from "react";
import type { LoadKpis, LoadPlan } from "@damm/optimizer-load";
import styles from "./Dashboard.module.css";

interface StrategyComparatorProps {
  hybrid: LoadPlan;
  traditional: LoadPlan;
}

type KpiKey = keyof LoadKpis;

const ROWS: Array<{
  key: KpiKey;
  label: string;
  higherIsBetter: boolean;
  format: (n: number) => string;
}> = [
  {
    key: "truckFillRatio",
    label: "Ocupacion",
    higherIsBetter: true,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    key: "routeAlignmentScore",
    label: "Alineacion ruta",
    higherIsBetter: true,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    key: "stopsWithDirectAccessRatio",
    label: "Acceso directo",
    higherIsBetter: true,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    key: "heavyItemsBottomRatio",
    label: "Pesados abajo",
    higherIsBetter: true,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    key: "returnablesReadinessScore",
    label: "Retornables",
    higherIsBetter: true,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    key: "estimatedPickingComplexity",
    label: "Picking (bajo = mejor)",
    higherIsBetter: false,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    key: "estimatedUnloadingComplexity",
    label: "Descarga (bajo = mejor)",
    higherIsBetter: false,
    format: (n) => `${Math.round(n * 100)}%`,
  },
];

export function StrategyComparator({
  hybrid,
  traditional,
}: StrategyComparatorProps) {
  const deltas = useMemo(() => {
    return ROWS.map((row) => {
      const a = hybrid.kpis[row.key];
      const b = traditional.kpis[row.key];
      const diff = a - b;
      const better = row.higherIsBetter ? diff > 0 : diff < 0;
      return {
        ...row,
        a,
        b,
        diff,
        better,
      };
    });
  }, [hybrid, traditional]);

  const hybridWins = deltas.filter((d) => d.better).length;
  const traditionalWins = deltas.filter((d) => !d.better && d.diff !== 0)
    .length;

  return (
    <div className={styles.footerPanel}>
      <div className={styles.panelHeader}>
        <h3>Comparativa carga</h3>
        <span>
          hibrido {hybridWins} vs tradicional {traditionalWins}
        </span>
      </div>
      <div className={styles.compareGrid}>
        <div className={styles.compareCard}>
          <h4>Tradicional (1 bloque)</h4>
          {deltas.map((d) => (
            <div key={d.key} className={styles.compareKpi}>
              <span>{d.label}</span>
              <strong>{d.format(d.b)}</strong>
            </div>
          ))}
        </div>
        <div className={styles.compareCard} data-best="true">
          <h4>Hibrido por ruta (4 bloques)</h4>
          {deltas.map((d) => (
            <div key={d.key} className={styles.compareKpi}>
              <span>{d.label}</span>
              <strong style={{ color: d.better ? "var(--ok)" : undefined }}>
                {d.format(d.a)}
              </strong>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.compareDelta}>
        <span>
          ahorro estimado de movimientos:{" "}
          <strong>
            {fmtSavingPct(
              traditional.kpis.estimatedUnloadingComplexity,
              hybrid.kpis.estimatedUnloadingComplexity,
            )}
          </strong>
        </span>
        <span>
          mejora alineacion ruta:{" "}
          <strong>
            {fmtPctDelta(
              hybrid.kpis.routeAlignmentScore,
              traditional.kpis.routeAlignmentScore,
            )}
          </strong>
        </span>
      </div>
    </div>
  );
}

function fmtPctDelta(a: number, b: number) {
  const diff = (a - b) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(0)} pp`;
}

function fmtSavingPct(traditional: number, hybrid: number) {
  if (traditional <= 0) return "-";
  const saved = ((traditional - hybrid) / traditional) * 100;
  return `${saved >= 0 ? "-" : "+"}${Math.abs(saved).toFixed(0)}%`;
}
