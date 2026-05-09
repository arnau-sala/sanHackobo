/**
 * Popup flotante con el detalle del palet seleccionado.
 *
 * Muestra:
 *   - id (P5), categoria (Cajas/Mixto/Barriles/Retornables), lateral, bloque
 *   - chips de las families de productos en el palet con su color
 *   - lista de items con cantidad y unidad
 *   - barra de "fill ratio" (53/60 cj)
 *   - boton de cerrar
 */
import type { PalletSlot } from "@damm/optimizer-load";
import type { PalletStackInfo } from "./buildPalletStack";
import { PALETTES, paletteFor } from "./productColors";
import styles from "./TruckView3D.module.css";

export type PalletPopupProps = {
  slot: PalletSlot;
  stack: PalletStackInfo;
  onClose: () => void;
};

export function PalletPopup({ slot, stack, onClose }: PalletPopupProps) {
  const sideLabel =
    slot.side === "right"
      ? "Lateral derecho"
      : slot.side === "left"
        ? "Lateral izquierdo"
        : slot.side === "rear"
          ? "Trasera"
          : "Centro";
  const fillPct = Math.round((slot.fillRatio ?? 0) * 100);

  const totalCases = stack.boxes.reduce(
    (a, b) => (b.unit === "Caja" || b.unit === "Pack" ? a + b.count : a),
    0,
  );
  const totalUnits = stack.boxes.reduce((a, b) => a + b.totalUnits, 0);

  // Chips: ordenados por cantidad descendente, max 4.
  const chips = Object.entries(stack.byFamily)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([family]) => ({
      family,
      palette: PALETTES[family] ?? PALETTES.default,
    }));

  // Lista de items agrupados por productId.
  const grouped = new Map<
    string,
    { name: string; productId: string; units: number; count: number; unit: string }
  >();
  for (const it of slot.items) {
    const k = it.productId;
    const cur = grouped.get(k) ?? {
      name: it.name,
      productId: it.productId,
      units: 0,
      count: 0,
      unit: it.unit,
    };
    cur.count += it.quantity;
    cur.units += it.quantity * unitsForBadge(it.unit);
    grouped.set(k, cur);
  }
  const items = Array.from(grouped.values()).sort((a, b) => b.count - a.count);

  return (
    <div
      className={styles.popup}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.popupHeader}>
        <div className={styles.popupHeaderLeft}>
          <span className={styles.popupSlot}>{slot.slotId}</span>
          <div>
            <h3>{stack.category}</h3>
            <p>
              {sideLabel}
              {slot.routeBlock ? ` · ${prettyBlock(slot.routeBlock)}` : ""}
              {slot.sequenceRange
                ? ` · Paradas ${slot.sequenceRange.from}-${slot.sequenceRange.to}`
                : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.popupClose}
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {chips.length > 0 && (
        <div className={styles.popupChips}>
          {chips.map((c) => (
            <span
              key={c.family}
              className={styles.popupChip}
              style={{ background: c.palette.swatch + "22", color: c.palette.swatch }}
              title={c.palette.label}
            >
              <i style={{ background: c.palette.swatch }} />
              {abbrev(c.palette.label)}
            </span>
          ))}
        </div>
      )}

      <ul className={styles.popupList}>
        {items.length === 0 && (
          <li className={styles.popupEmpty}>
            {slot.accessPriority === "returnables"
              ? "Espacio reservado para envases retornables. Lo iras llenando segun avancen las entregas."
              : "Palet vacio."}
          </li>
        )}
        {items.map((it) => {
          const palette = paletteFor(it.productId, it.name);
          return (
            <li key={it.productId}>
              <i style={{ background: palette.swatch }} aria-hidden />
              <div>
                <strong>{shortName(it.name)}</strong>
                <span>
                  {it.count} {it.unit.toLowerCase()}
                  {it.unit === "Caja" || it.unit === "Pack"
                    ? ` ×${unitsForBadge(it.unit)}`
                    : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={styles.popupFooter}>
        <span>Total: {totalUnits} uds.</span>
        <div className={styles.popupFill}>
          <strong>{fillPct}%</strong>
          <span>
            {totalCases > 0 ? `${totalCases} cj` : ""}
          </span>
          <div className={styles.popupBar}>
            <div style={{ width: `${Math.min(100, fillPct)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function unitsForBadge(unit: string): number {
  if (unit === "Caja") return 24;
  if (unit === "Pack") return 12;
  return 1;
}

function shortName(name: string): string {
  // Recorta nombres largos del catalogo Damm para que se lean bien.
  return name.replace(/\s+RET\.?\s*PP$/i, "").replace(/\s{2,}/g, " ").trim();
}

function abbrev(label: string): string {
  // ED, AV, COCA, CACA...
  const map: Record<string, string> = {
    "Estrella Damm": "ED",
    "Voll-Damm": "VOLL",
    "Free Damm": "FD",
    "Free Damm Tostada": "FDT",
    "Daura Damm": "EC",
    "Damm Lemon": "DL",
    "Inedit": "ID",
    "Turia": "TU",
    "Agua Veri": "AV",
    "Vichy / Font d'Or": "AG",
    "Coca-Cola": "CC",
    "Cacaolat": "CL",
    "Letona": "LT",
    "Vino": "VN",
    "Licores": "LI",
    "Snacks": "SN",
    "Cafe": "CF",
    "Limpieza": "LM",
  };
  return map[label] ?? label.slice(0, 4).toUpperCase();
}

function prettyBlock(id: string): string {
  return id
    .split("+")
    .map((p) => p.replace(/^block-/, "Bloque "))
    .join(" + ");
}
