import type { HandlingType, OrderItem } from "../types.js";

/**
 * Clasifica un item en una tipología de manipulación.
 *
 * Heurística:
 *   1. Si viene `handlingType` explícito, se respeta.
 *   2. Si la unidad es "Barril" → keg.
 *   3. Si la unidad es "Botella" → bottle.
 *   4. Si la unidad es "Pack" → box.
 *   5. Si la unidad es "Tubo" → keg (cilíndrico, pesado, abajo).
 *   6. Si la unidad es "Caja":
 *        - producto cerveza/agua/refresco retornable conocido → crate
 *        - resto → box
 *   7. "Unidad" → unit.
 *   8. fallback → unknown.
 */
export function classifyHandlingType(item: OrderItem): HandlingType {
  if (item.handlingType) return item.handlingType;

  const unit = (item.unit || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  const id = (item.productId || "").toLowerCase();

  if (unit === "barril") return "keg";
  if (unit === "botella") return "bottle";
  if (unit === "pack") return "box";
  if (unit === "tubo") return "keg";
  if (unit === "unidad" || unit === "un") return "unit";

  if (unit === "caja") {
    // Caja de cerveza/agua/refresco habitualmente retornable de la propia Damm o aliados.
    const isCrateLike =
      / ret\b| ret\.| 1\/3| 1\/5| 1\/4| 1\/2| 1\/1|vidrio|vr\b|glass/.test(name) ||
      /^(ed|dl|tu|vo|fd|fdt|fdl|ec|ve|vm)\d{2}/.test(id) ||
      /^0(am|lt|rf|ag|zu|li|cf|lm|ve)/.test(id);
    return isCrateLike ? "crate" : "box";
  }

  return "unknown";
}

/**
 * Indica si un item es retornable (envase vuelve al camión).
 * Heurística pragmática para hackathon:
 *   - Marcador explícito returnable=true.
 *   - Barriles INOX (keg) → siempre retornable.
 *   - Cajas de cerveza/agua con marcador "RET" / "VR" / vidrio retornable.
 */
export function inferReturnable(item: OrderItem, handling: HandlingType): boolean {
  if (typeof item.returnable === "boolean") return item.returnable;
  if (handling === "keg") return true;
  if (handling === "crate") {
    const name = (item.name || "").toUpperCase();
    if (/(\bRET\b|\bVR\b|RETORNABLE|VIDRIO RET)/.test(name)) return true;
  }
  return false;
}

/**
 * Heurística de apilabilidad. Botellas sueltas y cajas de unidades = no apilables encima.
 * Cajas retornables y cajas de packs = apilables.
 * Barriles = no apilables (forma cilíndrica + peso).
 */
export function inferStackable(item: OrderItem, handling: HandlingType): boolean {
  if (typeof item.stackable === "boolean") return item.stackable;
  switch (handling) {
    case "keg":
      return false;
    case "bottle":
      return false;
    case "unit":
      return true;
    case "crate":
      return true;
    case "box":
      return true;
    case "pack" as HandlingType:
      return true;
    default:
      return true;
  }
}
