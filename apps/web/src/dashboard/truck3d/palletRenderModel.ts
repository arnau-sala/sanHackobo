/**
 * Modelo de render del palet (estilo Figma export).
 *
 * A partir de un `PalletSlot` real del optimizador y del set de paradas
 * ya entregadas (`deliveredStopIds`), produce los datos minimos que la
 * SVG necesita para pintarlo:
 *
 *   - pos: posicion (col 0..1, row 0..3) en la grilla 4×2
 *   - cols: 2 franjas de carga (frente/trás en profundidad del palet),
 *           cada una con su `BrandKey` y numero de capas (0/1/2). Al
 *           entregar paradas las capas bajan → el camion se va vaciando.
 *   - typeLabel + accentColor + lista de productos para el popup.
 */
import type { LoadedItem, PalletSlot } from "@damm/optimizer-load";
import {
  ACCENT_BY_TYPE,
  BRANDS,
  familyToBrandKey,
  type BrandKey,
} from "./figmaBrands";
import { familyOf } from "./productColors";

export type RenderColumn = {
  brandKey: BrandKey;
  /** 0 = vacio (solo base), 1 = media carga, 2 = carga completa. */
  layers: 0 | 1 | 2;
};

export type RenderProduct = {
  brand: string;
  qty: number;
  unit: string;
};

export type RenderPallet = {
  slotId: string;
  pos: { col: 0 | 1; row: 0 | 1 | 2 | 3 };
  cols: [RenderColumn, RenderColumn];

  typeLabel: "Cajas" | "Mixto" | "Barriles" | "Retornables" | "Vacio";
  sideStr: string;
  stops: string;
  occupancy: number;
  totalItems: string;
  accentColor: string;
  products: RenderProduct[];

  hasContent: boolean;
};

const DEFAULT_BRAND: BrandKey = "xibeca";

/**
 * Calcula la familia dominante por franja a partir de los items
 * iniciales del palet. Cada palet tiene 2 franjas (frente/trás) y cada
 * una se asocia a la familia que mas pesa (primera y segunda).
 */
function pickDominantBrands(
  items: LoadedItem[],
  reservedForReturnables: boolean,
): { col0: BrandKey; col1: BrandKey } {
  if (reservedForReturnables) {
    return { col0: "retornable", col1: "retornable" };
  }

  if (items.length === 0) {
    return { col0: DEFAULT_BRAND, col1: DEFAULT_BRAND };
  }

  // Acumulamos qty por (family, isKeg).
  const map = new Map<string, { qty: number; family: string; isKeg: boolean }>();
  for (const it of items) {
    const family = familyOf(it.productId, it.name);
    const isKeg = it.handlingType === "keg";
    const key = `${family}|${isKeg ? "keg" : "box"}`;
    const cur = map.get(key) ?? { qty: 0, family, isKeg };
    cur.qty += it.quantity;
    map.set(key, cur);
  }
  const ranked = [...map.values()].sort((a, b) => b.qty - a.qty);
  const top = ranked[0];
  const second = ranked[1] ?? top;

  const col0 = familyToBrandKey(top.family, { isKeg: top.isKeg });
  const col1 = familyToBrandKey(second.family, { isKeg: second.isKeg });
  return { col0, col1 };
}

/**
 * Calcula cuantas capas (0/1/2) renderizar por franja a partir de la
 * fraccion de carga que queda en el palet (qty restante / qty inicial).
 *
 * La asignacion items → franja es virtual (2 franjas en profundidad):
 *   - col0 = familia mas presente (franja delantera, hacia cabina)
 *   - col1 = segunda (franja trasera)
 * Cada franja se vacia cuando se entregan los items de su familia.
 */
function computeLayersPerColumn(
  items: LoadedItem[],
  remainingItems: LoadedItem[],
  brands: { col0: BrandKey; col1: BrandKey },
): { layers0: 0 | 1 | 2; layers1: 0 | 1 | 2 } {
  if (items.length === 0) {
    return { layers0: 0, layers1: 0 };
  }
  if (remainingItems.length === 0) {
    return { layers0: 0, layers1: 0 };
  }

  // Estrategia simple y robusta: la altura de cada franja refleja el
  // ratio global remaining/initial del palet. Asi al entregar, ambas
  // franjas bajan proporcionalmente y nunca tenemos saltos raros.
  const totalInit = items.reduce((a, it) => a + it.quantity, 0);
  const totalRem = remainingItems.reduce((a, it) => a + it.quantity, 0);
  const ratio = totalInit > 0 ? totalRem / totalInit : 0;

  const layersFor = (r: number): 0 | 1 | 2 => {
    if (r >= 0.55) return 2;
    if (r >= 0.15) return 1;
    return 0;
  };

  // Si una columna corresponde a una familia que ya esta totalmente
  // entregada, la mostramos vacia aunque el ratio global sea alto.
  const families = new Set(
    remainingItems.map((it) => brandOf(it).key),
  );
  const has0 = families.has(brands.col0);
  const has1 = families.has(brands.col1);

  // Para que se note la diferencia entre las 2 franjas cuando una
  // familia se vacia antes que la otra, tambien combinamos el "has".
  const layers0 = has0 ? layersFor(ratio) : 0;
  const layers1 = has1 ? layersFor(ratio) : 0;
  return { layers0, layers1 };
}

function brandOf(item: LoadedItem): { key: BrandKey } {
  const family = familyOf(item.productId, item.name);
  return { key: familyToBrandKey(family, { isKeg: item.handlingType === "keg" }) };
}

function decideTypeLabel(
  items: LoadedItem[],
  reservedForReturnables: boolean,
): RenderPallet["typeLabel"] {
  if (reservedForReturnables) return "Retornables";
  if (items.length === 0) return "Vacio";
  let kegs = 0;
  let boxes = 0;
  for (const it of items) {
    if (it.handlingType === "keg") kegs += it.quantity;
    else boxes += it.quantity;
  }
  if (kegs > 0 && boxes === 0) return "Barriles";
  if (kegs > 0 && boxes > 0) return "Mixto";
  return "Cajas";
}

function pluralUnit(unit: string, count: number): string {
  if (unit === "Caja") return count === 1 ? "caja" : "cajas";
  if (unit === "Pack") return count === 1 ? "pack" : "packs";
  if (unit === "Barril") return count === 1 ? "barril" : "barriles";
  if (unit === "Botella") return count === 1 ? "botella" : "botellas";
  return unit.toLowerCase();
}

function unitsPerCase(unit: string): number {
  if (unit === "Caja") return 24;
  if (unit === "Pack") return 12;
  return 1;
}

function buildProductList(
  items: LoadedItem[],
  brands: { col0: BrandKey; col1: BrandKey },
): RenderProduct[] {
  if (items.length === 0) return [];

  const byProduct = new Map<
    string,
    { brand: string; qty: number; unit: string; sample: LoadedItem }
  >();
  for (const it of items) {
    const cur = byProduct.get(it.productId) ?? {
      brand: shortName(it.name),
      qty: 0,
      unit: it.unit,
      sample: it,
    };
    cur.qty += it.quantity;
    byProduct.set(it.productId, cur);
  }

  const list = [...byProduct.values()].sort((a, b) => b.qty - a.qty);
  return list.slice(0, 4).map((p) => {
    const factor = unitsPerCase(p.unit);
    const unit =
      factor > 1
        ? `${pluralUnit(p.unit, p.qty)} ×${factor}`
        : pluralUnit(p.unit, p.qty);
    return { brand: p.brand, qty: p.qty, unit };
  });
}

function shortName(name: string): string {
  return name.replace(/\s+RET\.?\s*PP$/i, "").replace(/\s{2,}/g, " ").trim();
}

export type BuildRenderOptions = {
  /** Indice 0..7 del palet en el array. Determina la posicion en grilla. */
  index: number;
  deliveredStopIds: Set<string>;
};

export function buildRenderPallet(
  slot: PalletSlot,
  opts: BuildRenderOptions,
): RenderPallet {
  const { index, deliveredStopIds } = opts;
  const remainingItems = slot.items.filter(
    (it) => !deliveredStopIds.has(it.stopId),
  );
  const reservedForReturnables = slot.accessPriority === "returnables";

  const brands = pickDominantBrands(slot.items, reservedForReturnables);
  const { layers0, layers1 } = computeLayersPerColumn(
    slot.items,
    remainingItems,
    brands,
  );

  const typeLabel = decideTypeLabel(remainingItems, reservedForReturnables);
  const accentColor = ACCENT_BY_TYPE[typeLabel] ?? "#3B82F6";

  const totalInit = slot.items.reduce((a, it) => a + it.quantity, 0);
  const totalRem = remainingItems.reduce((a, it) => a + it.quantity, 0);
  const baseOccupancy =
    slot.fillRatio !== undefined
      ? Math.round(slot.fillRatio * 100)
      : 80;
  const occupancy =
    totalInit > 0
      ? Math.max(0, Math.min(100, Math.round((totalRem / totalInit) * baseOccupancy)))
      : 0;

  const products = buildProductList(slot.items, brands);

  let totalItems: string;
  if (remainingItems.length === 0) {
    totalItems = "Palet vacio";
  } else if (typeLabel === "Barriles") {
    totalItems = `${totalRem} barriles`;
  } else if (typeLabel === "Retornables") {
    totalItems = `${totalRem} cajas`;
  } else {
    const totalUnits = remainingItems.reduce(
      (a, it) => a + it.quantity * unitsPerCase(it.unit),
      0,
    );
    totalItems = `${totalUnits} uds.`;
  }

  const sideStr =
    slot.side === "left"
      ? "Lateral izquierdo"
      : slot.side === "right"
        ? "Lateral derecho"
        : slot.side === "rear"
          ? "Trasera"
          : "Centro";

  const stops = slot.sequenceRange
    ? `Paradas ${slot.sequenceRange.from}-${slot.sequenceRange.to}`
    : reservedForReturnables
      ? "Reservado retornables"
      : "—";

  // Posicion en grilla: 4 filas (cabina → trasera) × 2 columnas
  // (lateral izquierdo / lateral derecho de la carga). Mapeamos por
  // indice secuencial: P1..P4 → izquierda, P5..P8 → derecha.
  const col = (index < 4 ? 0 : 1) as 0 | 1;
  const row = (index % 4) as 0 | 1 | 2 | 3;

  return {
    slotId: slot.slotId,
    pos: { col, row },
    cols: [
      { brandKey: brands.col0, layers: layers0 },
      { brandKey: brands.col1, layers: layers1 },
    ],
    typeLabel,
    sideStr,
    stops,
    occupancy,
    totalItems,
    accentColor,
    products,
    hasContent: remainingItems.length > 0,
  };
}

/** Util para que TruckView3D conozca las dimensiones del slot. */
export function slotBox(col: 0 | 1, row: 0 | 1 | 2 | 3): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} {
  const x0 = col === 0 ? 0.15 : 5.25;
  const x1 = col === 0 ? 2.75 : 7.85;
  const y0 = 0.3 + row * 2.7;
  const y1 = y0 + 2.4;
  return { x0, x1, y0, y1 };
}

/** Re-export por conveniencia. */
export { BRANDS };
