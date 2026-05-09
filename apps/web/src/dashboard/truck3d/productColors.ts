/**
 * Paleta de colores por tipo de producto Damm.
 *
 * El usuario pidio: Estrella roja, agua azul, cacaolat marron. Usamos los
 * prefijos de productId del catalogo (ED, VO, FD, EC, DL, ID, VE, AG, LT,
 * RF, AM, LM, CF, LI...) para asignar un color base + sombras.
 *
 * Cada paleta tiene 3 tonos: top (clarito), front (medio), side (oscuro)
 * para dar el efecto de iluminacion isometrica en las 3 caras visibles.
 */

export type Palette = {
  top: string;
  front: string;
  side: string;
  /** Color hex sencillo para chips/leyenda. */
  swatch: string;
  label: string;
};

const PRODUCT_PALETTES: Record<string, Palette> = {
  // Cervezas Damm — rojos calidos y ocres
  estrella: { top: "#ef2922", front: "#cc1812", side: "#8b0d0a", swatch: "#e10600", label: "Estrella Damm" },
  voll: { top: "#7d1a1a", front: "#5b0f0f", side: "#3a0606", swatch: "#5b0f0f", label: "Voll-Damm" },
  free: { top: "#f7d774", front: "#e2bb4d", side: "#a8841c", swatch: "#e2bb4d", label: "Free Damm" },
  freetostada: { top: "#c8956a", front: "#9c6a3f", side: "#5e3e21", swatch: "#9c6a3f", label: "Free Damm Tostada" },
  daura: { top: "#5fb872", front: "#3a8a4a", side: "#1f5128", swatch: "#3a8a4a", label: "Daura Damm" },
  damm_lemon: { top: "#fce14e", front: "#e7c613", side: "#9b8607", swatch: "#e7c613", label: "Damm Lemon" },
  inedit: { top: "#9b1f3c", front: "#6e1228", side: "#420916", swatch: "#6e1228", label: "Inedit" },
  turia: { top: "#cf5a1a", front: "#9c4111", side: "#5e2806", swatch: "#9c4111", label: "Turia" },
  // Aguas — azules
  agua_veri: { top: "#5fb8ff", front: "#1e88e5", side: "#0d47a1", swatch: "#1e88e5", label: "Agua Veri" },
  vichy: { top: "#34d3e2", front: "#0fb6c5", side: "#066c75", swatch: "#0fb6c5", label: "Vichy / Font d'Or" },
  // Refrescos
  cocacola: { top: "#a51f17", front: "#7a120c", side: "#440805", swatch: "#7a120c", label: "Coca-Cola" },
  cacaolat: { top: "#a06a3a", front: "#754820", side: "#3d260f", swatch: "#754820", label: "Cacaolat" },
  letona: { top: "#caa988", front: "#9a7a55", side: "#5b4530", swatch: "#9a7a55", label: "Letona" },
  // Vinos / licores
  vino: { top: "#722454", front: "#4d1538", side: "#260a1c", swatch: "#4d1538", label: "Vino" },
  licor: { top: "#c89358", front: "#9c6a31", side: "#583b18", swatch: "#9c6a31", label: "Licores" },
  // Otros
  snacks: { top: "#fda64a", front: "#e0801b", side: "#8a4d09", swatch: "#e0801b", label: "Snacks" },
  cafe: { top: "#6d3b1a", front: "#48230d", side: "#22110a", swatch: "#48230d", label: "Cafe" },
  limpieza: { top: "#a4b1c7", front: "#76869f", side: "#3f4a5c", swatch: "#76869f", label: "Limpieza" },
  unidad: { top: "#cdd5e0", front: "#94a3b8", side: "#475569", swatch: "#94a3b8", label: "Material" },
  default: { top: "#a1a1aa", front: "#71717a", side: "#3f3f46", swatch: "#71717a", label: "Otros" },
};

/**
 * Familia visual de un producto. Se infiere por prefijo del codigo, con
 * fallback al nombre. Sirve para colorear y para etiquetar el palet
 * (Cajas / Mixto / Barriles / Retornables).
 */
export function familyOf(productId: string, name?: string): keyof typeof PRODUCT_PALETTES {
  const id = productId.toUpperCase();
  const n = (name ?? "").toUpperCase();

  // Cervezas Damm
  if (id.startsWith("ED")) return "estrella";
  if (id.startsWith("VO")) return "voll";
  if (id.startsWith("FDT")) return "freetostada";
  if (id.startsWith("FD")) return "free";
  if (id.startsWith("EC")) return "daura";
  if (id.startsWith("DL")) return "damm_lemon";
  if (id.startsWith("ID")) return "inedit";
  if (id.startsWith("TU")) return "turia";

  // Aguas
  if (id.startsWith("VE") || n.includes("VERI")) return "agua_veri";
  if (id.includes("AG0") || n.includes("VICHY") || n.includes("FONT D")) return "vichy";

  // Refrescos
  if (n.includes("COCA")) return "cocacola";
  if (n.includes("CACAOLAT")) return "cacaolat";
  if (id.startsWith("0LT") || n.includes("LETONA") || n.includes("CACAOLAT")) {
    if (n.includes("CACAOLAT")) return "cacaolat";
    return "letona";
  }

  // Vinos / licores
  if (id.includes("VE0") && n.includes("VINO")) return "vino";
  if (id.startsWith("0LI") || n.includes("BRANDY") || n.includes("GIN") || n.includes("RATAFIA")) return "licor";

  // Otros
  if (id.startsWith("0AM")) return "snacks";
  if (id.startsWith("0CF") || n.includes("BONKA")) return "cafe";
  if (id.startsWith("0LM")) return "limpieza";
  if (n.includes("VASO") || n.includes("COPA") || n.includes("SERVILLET")) return "unidad";

  return "default";
}

export function paletteFor(productId: string, name?: string): Palette {
  return PRODUCT_PALETTES[familyOf(productId, name)] ?? PRODUCT_PALETTES.default;
}

/** Lista compacta de paletas para una leyenda. */
export function uniquePalettes(
  items: Array<{ productId: string; name?: string }>,
): Array<{ key: string; palette: Palette }> {
  const seen = new Map<string, Palette>();
  for (const it of items) {
    const key = familyOf(it.productId, it.name);
    if (!seen.has(key)) seen.set(key, PRODUCT_PALETTES[key] ?? PRODUCT_PALETTES.default);
  }
  return Array.from(seen.entries()).map(([key, palette]) => ({ key, palette }));
}

export const PALETTES = PRODUCT_PALETTES;
