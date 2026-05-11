/**
 * Convierte la lista de `LoadedItem` de un palet en una estructura
 * "renderizable" donde cada caja/barril ocupa un hueco fisico.
 *
 * Estrategia:
 *   - Agrupamos items por productId + stopId (asi un mismo cliente con
 *     varias cajas del mismo producto comparte color y se renderiza en
 *     una pila contigua).
 *   - Cada grupo se mapea a N "boxes" visuales (una por caja real, hasta
 *     un maximo razonable: limitamos para no saturar la escena).
 *   - Se distribuyen en una pila 2x2 por capa (4 boxes/layer) y se
 *     apilan hacia arriba.
 *
 * Output: cada box tiene posicion local en el palet (col 0..1, row 0..1,
 * layer 0..3), color, productId, stopId, handlingType y `quantity`.
 */
import type { LoadedItem } from "@damm/optimizer-load";
import { familyOf, paletteFor, type Palette } from "./productColors";

export type RenderBox = {
  /** Indice del item en el palet, util para keys de React. */
  key: string;
  productId: string;
  productName: string;
  stopId: string;
  clientName: string;
  sequence: number;
  handlingType: LoadedItem["handlingType"];
  returnable: boolean;
  /** Posicion local relativa dentro del palet en celdas 0..1. */
  cellX: 0 | 1;
  cellY: 0 | 1;
  /** Capa vertical 0 = abajo. */
  layer: number;
  palette: Palette;
  family: string;
  /** Numero de cajas/barriles representados por este box visual. */
  count: number;
  /** Cuantas unidades en total representan estos count boxes. */
  totalUnits: number;
  /** "Caja", "Barril", "Botella"... copiado del item original. */
  unit: string;
};

export type PalletCategory = "Cajas" | "Barriles" | "Mixto" | "Retornables" | "Vacio";

export type PalletStackInfo = {
  boxes: RenderBox[];
  totalCount: number;
  category: PalletCategory;
  byFamily: Record<string, number>;
};

const MAX_VISUAL_BOXES = 8; // 4 por capa, 2 capas — visualmente limpio

/**
 * Decide la "capa" visual para una pila (bottom = pesados/barriles, top =
 * ligeros). Honra la informacion del optimizer si esta disponible.
 */
function visualLayer(item: LoadedItem, fallback: number): number {
  if (item.layer === "bottom") return 0;
  if (item.layer === "middle") return 1;
  if (item.layer === "top") return 2;
  return fallback;
}

export function buildPalletStack(
  items: LoadedItem[],
  options: { reservedForReturnables?: boolean } = {},
): PalletStackInfo {
  if (items.length === 0) {
    return {
      boxes: [],
      totalCount: 0,
      category: options.reservedForReturnables ? "Retornables" : "Vacio",
      byFamily: {},
    };
  }

  // 1. Agrupar por productId + stopId para que las cajas iguales sean
  //    contiguas en la pila y compartan color.
  const groupKey = (i: LoadedItem) => `${i.productId}::${i.stopId}`;
  const groups = new Map<string, { items: LoadedItem[]; totalQty: number }>();
  for (const it of items) {
    const k = groupKey(it);
    const g = groups.get(k) ?? { items: [], totalQty: 0 };
    g.items.push(it);
    g.totalQty += it.quantity;
    groups.set(k, g);
  }

  // 2. Aplanar los grupos en boxes visuales. Cada grupo se renderiza con
  //    al menos 1 box; si tiene mucha cantidad, hasta 3 boxes para que se
  //    vea el volumen, pero respetamos el limite total por palet.
  type ProtoBox = Omit<RenderBox, "cellX" | "cellY" | "layer"> & {
    desiredLayer: number;
  };
  const proto: ProtoBox[] = [];

  for (const [key, group] of groups) {
    const sample = group.items[0];
    const palette = paletteFor(sample.productId, sample.name);
    const family = familyOf(sample.productId, sample.name);

    // boxes visuales por grupo: 1..3 (basado en cantidad logaritmica).
    const visualBoxes = Math.min(3, Math.max(1, Math.round(Math.log2(group.totalQty + 1))));

    for (let i = 0; i < visualBoxes; i++) {
      proto.push({
        key: `${key}-${i}`,
        productId: sample.productId,
        productName: sample.name,
        stopId: sample.stopId,
        clientName: sample.clientName,
        sequence: sample.sequence,
        handlingType: sample.handlingType,
        returnable: sample.returnable,
        unit: sample.unit,
        palette,
        family,
        count: Math.ceil(group.totalQty / visualBoxes),
        totalUnits: Math.ceil(group.totalQty / visualBoxes) * unitsPerCase(sample),
        desiredLayer: visualLayer(sample, 1),
      });
    }
  }

  // 3. Limitar a MAX_VISUAL_BOXES priorizando bottom/middle (mas visuales).
  proto.sort((a, b) => {
    if (a.desiredLayer !== b.desiredLayer) return a.desiredLayer - b.desiredLayer;
    return a.sequence - b.sequence;
  });
  const trimmed = proto.slice(0, MAX_VISUAL_BOXES);

  // 4. Asignar cellX/cellY/layer secuencialmente: cada layer tiene 2x2 = 4 huecos.
  const boxes: RenderBox[] = [];
  let layer = 0;
  let posInLayer = 0;
  for (const p of trimmed) {
    const cellX = (posInLayer % 2) as 0 | 1;
    const cellY = (Math.floor(posInLayer / 2) % 2) as 0 | 1;
    boxes.push({
      key: p.key,
      productId: p.productId,
      productName: p.productName,
      stopId: p.stopId,
      clientName: p.clientName,
      sequence: p.sequence,
      handlingType: p.handlingType,
      returnable: p.returnable,
      unit: p.unit,
      palette: p.palette,
      family: p.family,
      count: p.count,
      totalUnits: p.totalUnits,
      cellX,
      cellY,
      layer,
    });
    posInLayer++;
    if (posInLayer >= 4) {
      posInLayer = 0;
      layer++;
    }
  }

  // 5. Categoria del palet — para la card resumen del bottom strip.
  const counts = {
    Cajas: 0,
    Barriles: 0,
    Botellas: 0,
    Otros: 0,
  };
  for (const it of items) {
    if (it.handlingType === "keg") counts.Barriles += it.quantity;
    else if (it.handlingType === "crate" || it.handlingType === "box") counts.Cajas += it.quantity;
    else if (it.handlingType === "bottle") counts.Botellas += it.quantity;
    else counts.Otros += it.quantity;
  }
  let category: PalletCategory = "Mixto";
  if (options.reservedForReturnables) category = "Retornables";
  else if (counts.Barriles > 0 && counts.Cajas === 0) category = "Barriles";
  else if (counts.Cajas > 0 && counts.Barriles === 0 && counts.Botellas === 0) category = "Cajas";

  // 6. Familia mas presente, para que la card del bottom strip pinte un
  //    color dominante.
  const byFamily: Record<string, number> = {};
  for (const it of items) {
    const f = familyOf(it.productId, it.name);
    byFamily[f] = (byFamily[f] ?? 0) + it.quantity;
  }

  return {
    boxes,
    totalCount: items.reduce((a, i) => a + i.quantity, 0),
    category,
    byFamily,
  };
}

function unitsPerCase(item: LoadedItem): number {
  // Estimacion simple por unidad. Solo se usa para el "Total: N uds." del
  // popup, no para el optimizer.
  switch (item.unit) {
    case "Caja":
      return 24;
    case "Pack":
      return 12;
    case "Barril":
      return 1;
    case "Botella":
      return 1;
    case "Tubo":
      return 1;
    default:
      return 1;
  }
}
