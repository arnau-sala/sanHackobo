/**
 * Paleta de colores por producto / familia de marca.
 *
 * Tonos top / front / side simulan iluminación isométrica (superior más
 * clara, lateral más oscura). Los hex se aproximan a packaging y
 * identidad visual pública de cada marca (no son oficiales PMS).
 *
 * Prefijos `productId` siguen el catálogo mock (ED, VO, FD, FDT, EC, DL,
 * ID, TU, VE, 0AG Vichy/Font d'Or, 0LT Letona/Cacaolat, etc.).
 */

export type Palette = {
  top: string;
  front: string;
  side: string;
  swatch: string;
  label: string;
};

const PRODUCT_PALETTES: Record<string, Palette> = {
  // --- Cervezas Damm ---
  /** Estrella Damm — rojo corporativo (~PMS 485 C). */
  estrella: {
    top: "#FF5A52",
    front: "#E30613",
    side: "#9A0A14",
    swatch: "#E30613",
    label: "Estrella Damm",
  },
  /** Voll-Damm — negro / grafito (etiqueta negra, rojo en logo). */
  voll: {
    top: "#4A4A4A",
    front: "#1A1A1A",
    side: "#0D0D0D",
    swatch: "#1A1A1A",
    label: "Voll-Damm",
  },
  /** Free Damm 0,0% — verde packaging “sin alcohol”. */
  free: {
    top: "#4ADE80",
    front: "#16A34A",
    side: "#14532D",
    swatch: "#16A34A",
    label: "Free Damm",
  },
  /** Free Damm Tostada — ámbar / caramelo (lager tostada). */
  freetostada: {
    top: "#D4A574",
    front: "#A67C52",
    side: "#6B4E32",
    swatch: "#A67C52",
    label: "Free Damm Tostada",
  },
  /** Daura — verde medalla / botella (gluten-free). */
  daura: {
    top: "#9CCC65",
    front: "#689F38",
    side: "#33691E",
    swatch: "#689F38",
    label: "Daura Damm",
  },
  /** Damm Lemon — amarillo limón vivo. */
  damm_lemon: {
    top: "#FFEE58",
    front: "#FDD835",
    side: "#C6A700",
    swatch: "#FDD835",
    label: "Damm Lemon",
  },
  /** Inedit — azul / violeta (carta artesanal). */
  inedit: {
    top: "#7E8CE0",
    front: "#3F51B5",
    side: "#1A237E",
    swatch: "#3F51B5",
    label: "Inedit",
  },
  /** Turia — naranja valenciano. */
  turia: {
    top: "#FFAB40",
    front: "#F57C00",
    side: "#BF360C",
    swatch: "#F57C00",
    label: "Turia",
  },
  /** Xibeca — verde intenso (marca regional). */
  xibeca: {
    top: "#43A047",
    front: "#2E7D32",
    side: "#1B5E20",
    swatch: "#2E7D32",
    label: "Xibeca",
  },

  // --- Aguas y refrescos distribuidos ---
  agua_veri: {
    top: "#4DD0E1",
    front: "#00ACC1",
    side: "#006064",
    swatch: "#00ACC1",
    label: "Agua Veri",
  },
  /** Vichy Catalan — verde botella característico. */
  vichy: {
    top: "#8BC34A",
    front: "#689F38",
    side: "#33691E",
    swatch: "#689F38",
    label: "Vichy Catalan",
  },
  /** Font d'Or / Maximum — azul agua mineral. */
  font_dor: {
    top: "#64B5F6",
    front: "#1E88E5",
    side: "#0D47A1",
    swatch: "#1E88E5",
    label: "Font d'Or",
  },
  cocacola: {
    top: "#FF5C4D",
    front: "#E4002B",
    side: "#A3001E",
    swatch: "#E4002B",
    label: "Coca-Cola",
  },
  /** Cacaolat — amarillo + marrón chocolate. */
  cacaolat: {
    top: "#FFEB3B",
    front: "#C9A227",
    side: "#5D4037",
    swatch: "#C9A227",
    label: "Cacaolat",
  },
  /** Letona — dorado / crema (batido). */
  letona: {
    top: "#F0E6C8",
    front: "#C9B37E",
    side: "#8D7B52",
    swatch: "#C9B37E",
    label: "Letona",
  },

  vino: {
    top: "#8E4585",
    front: "#5D1E4A",
    side: "#2D0F24",
    swatch: "#5D1E4A",
    label: "Vino",
  },
  licor: {
    top: "#D4A574",
    front: "#A67C52",
    side: "#5D4037",
    swatch: "#A67C52",
    label: "Licores",
  },

  snacks: {
    top: "#FFCA28",
    front: "#FF8F00",
    side: "#E65100",
    swatch: "#FF8F00",
    label: "Snacks",
  },
  cafe: {
    top: "#6D4C41",
    front: "#4E342E",
    side: "#3E2723",
    swatch: "#4E342E",
    label: "Cafe",
  },
  limpieza: {
    top: "#B0BEC5",
    front: "#78909C",
    side: "#455A64",
    swatch: "#78909C",
    label: "Limpieza",
  },
  unidad: {
    top: "#CFD8DC",
    front: "#90A4AE",
    side: "#546E7A",
    swatch: "#90A4AE",
    label: "Material",
  },
  default: {
    top: "#B0BEC5",
    front: "#78909C",
    side: "#455A64",
    swatch: "#78909C",
    label: "Otros",
  },
};

export function familyOf(
  productId: string,
  name?: string,
): keyof typeof PRODUCT_PALETTES {
  const id = productId.toUpperCase();
  const n = (name ?? "").toUpperCase();

  if (id.startsWith("XI") || n.includes("XIBECA")) return "xibeca";
  if (id.startsWith("ED")) return "estrella";
  if (id.startsWith("VO")) return "voll";
  if (id.startsWith("FDT")) return "freetostada";
  if (id.startsWith("FD")) return "free";
  if (id.startsWith("EC")) return "daura";
  if (id.startsWith("DL")) return "damm_lemon";
  if (id.startsWith("ID")) return "inedit";
  if (id.startsWith("TU")) return "turia";

  if (id.startsWith("VE") || n.includes("VERI")) return "agua_veri";

  if (n.includes("FONT D") || n.includes("FONT D'OR") || n.includes("MAXIMUM NATURAL")) {
    return "font_dor";
  }
  if (id.includes("AG0") || n.includes("VICHY")) return "vichy";

  if (n.includes("COCA")) return "cocacola";
  if (n.includes("CACAOLAT")) return "cacaolat";
  if (id.startsWith("0LT") || n.includes("LETONA")) {
    if (n.includes("CACAOLAT")) return "cacaolat";
    if (n.includes("LETONA")) return "letona";
    return "cacaolat";
  }

  if (id.includes("VE0") && n.includes("VINO")) return "vino";
  if (id.startsWith("0LI") || n.includes("BRANDY") || n.includes("GIN") || n.includes("RATAFIA")) {
    return "licor";
  }

  if (id.startsWith("0AM")) return "snacks";
  if (id.startsWith("0CF") || n.includes("BONKA")) return "cafe";
  if (id.startsWith("0LM")) return "limpieza";
  if (n.includes("VASO") || n.includes("COPA") || n.includes("SERVILLET")) return "unidad";

  return "default";
}

export function paletteFor(productId: string, name?: string): Palette {
  return PRODUCT_PALETTES[familyOf(productId, name)] ?? PRODUCT_PALETTES.default;
}

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
