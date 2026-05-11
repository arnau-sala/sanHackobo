import type { EnrichedItem, Layer } from "../types.js";

/**
 * Decide la capa lógica del item dentro del palet.
 *
 *   bottom  → barriles, cajas pesadas (>=20kg/unidad), tubos CO2.
 *   middle  → cajas estándar, packs, cosas apilables.
 *   top     → botellas sueltas, unidades pequeñas y frágiles.
 *
 * Esta capa es lógica (no es geometría real): sirve para informar al operario
 * y para calcular el KPI heavyItemsBottomRatio.
 */
export function chooseLayer(item: EnrichedItem): Layer {
  const unitWeight =
    item.totalWeight / Math.max(1, item.quantity); // peso por unidad

  switch (item.handlingType) {
    case "keg":
      return "bottom";
    case "crate":
      return unitWeight >= 12 ? "bottom" : "middle";
    case "box":
      return unitWeight >= 20 ? "bottom" : "middle";
    case "pack" as EnrichedItem["handlingType"]:
      return "middle";
    case "bottle":
      return "top";
    case "unit":
      return unitWeight >= 5 ? "middle" : "top";
    default:
      return "middle";
  }
}
