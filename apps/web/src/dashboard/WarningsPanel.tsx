/**
 * Lista de warnings generados por `generateLoadWarnings`.
 *
 * Pinta severidad y categorias (capacity, heavy_item, access, returnables,
 * stacking, missing_data) con colores y iconos basicos.
 */
import type { LoadWarning } from "@damm/optimizer-load";
import styles from "./Dashboard.module.css";

interface WarningsPanelProps {
  warnings: LoadWarning[];
}

const ICONS: Record<string, string> = {
  capacity: "▣",
  heavy_item: "↡",
  access: "↔",
  missing_data: "?",
  returnables: "♻",
  stacking: "≡",
};

const TITLES: Record<string, string> = {
  capacity: "Capacidad",
  heavy_item: "Producto pesado",
  access: "Accesibilidad",
  missing_data: "Datos faltantes",
  returnables: "Retornables",
  stacking: "Apilado",
};

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  return (
    <div className={styles.footerPanel}>
      <div className={styles.panelHeader}>
        <h3>Alertas operativas</h3>
        <span>{warnings.length}</span>
      </div>
      {warnings.length === 0 ? (
        <p className={styles.empty}>No hay alertas para esta carga.</p>
      ) : (
        <ul className={styles.warningList}>
          {warnings.map((w, i) => (
            <li
              key={`${w.type}-${i}`}
              className={styles.warningItem}
              data-sev={w.severity}
            >
              <span className={styles.warningIcon}>{ICONS[w.type] ?? "!"}</span>
              <div className={styles.warningBody}>
                <strong>{TITLES[w.type] ?? w.type}</strong>
                <small>{w.severity.toUpperCase()}</small>
                <div>{w.message}</div>
                {(w.relatedSlotId ||
                  w.relatedStopId ||
                  w.relatedProductId) && (
                  <small>
                    {w.relatedSlotId ? `slot ${w.relatedSlotId} · ` : ""}
                    {w.relatedStopId ? `stop ${w.relatedStopId} · ` : ""}
                    {w.relatedProductId ? `prod ${w.relatedProductId}` : ""}
                  </small>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
