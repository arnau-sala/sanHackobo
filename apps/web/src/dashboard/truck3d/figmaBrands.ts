/**
 * Marcas visibles en el camión 3D: mismos tonos que `productColors.ts`
 * (identidad de producto), en formato top/front/side para las caras SVG.
 *
 * `familyToBrandKey` enlaza la clave de familia del optimizador con esta
 * tabla (incl. barriles por familia).
 */

export type Brand = {
  name: string;
  top: string;
  front: string;
  side: string;
  abbr: string;
  isBarrel: boolean;
};

export const BRANDS = {
  estrellaDamm: {
    name: "Estrella Damm",
    top: "#FF5A52",
    front: "#E30613",
    side: "#9A0A14",
    abbr: "ED",
    isBarrel: false,
  },
  vollDamm: {
    name: "Voll-Damm",
    top: "#4A4A4A",
    front: "#1A1A1A",
    side: "#0D0D0D",
    abbr: "VD",
    isBarrel: false,
  },
  xibeca: {
    name: "Xibeca",
    top: "#43A047",
    front: "#2E7D32",
    side: "#1B5E20",
    abbr: "XIB",
    isBarrel: false,
  },
  dammLemon: {
    name: "Damm Lemon",
    top: "#FFEE58",
    front: "#FDD835",
    side: "#C6A700",
    abbr: "DL",
    isBarrel: false,
  },
  freeDamm: {
    name: "Free Damm",
    top: "#4ADE80",
    front: "#16A34A",
    side: "#14532D",
    abbr: "FD",
    isBarrel: false,
  },
  freeDammTostada: {
    name: "Free Damm Tostada",
    top: "#D4A574",
    front: "#A67C52",
    side: "#6B4E32",
    abbr: "FDT",
    isBarrel: false,
  },
  dauraDamm: {
    name: "Daura Damm",
    top: "#9CCC65",
    front: "#689F38",
    side: "#33691E",
    abbr: "DA",
    isBarrel: false,
  },
  inedit: {
    name: "Inedit",
    top: "#7E8CE0",
    front: "#3F51B5",
    side: "#1A237E",
    abbr: "IN",
    isBarrel: false,
  },
  turia: {
    name: "Turia",
    top: "#FFAB40",
    front: "#F57C00",
    side: "#BF360C",
    abbr: "TU",
    isBarrel: false,
  },
  cacaolat: {
    name: "Cacaolat",
    top: "#FFEB3B",
    front: "#C9A227",
    side: "#5D4037",
    abbr: "CAC",
    isBarrel: false,
  },
  letona: {
    name: "Letona",
    top: "#F0E6C8",
    front: "#C9B37E",
    side: "#8D7B52",
    abbr: "LT",
    isBarrel: false,
  },
  aguaVeri: {
    name: "Agua Veri",
    top: "#4DD0E1",
    front: "#00ACC1",
    side: "#006064",
    abbr: "AV",
    isBarrel: false,
  },
  vichy: {
    name: "Vichy Catalan",
    top: "#8BC34A",
    front: "#689F38",
    side: "#33691E",
    abbr: "VC",
    isBarrel: false,
  },
  fontDor: {
    name: "Font d'Or",
    top: "#64B5F6",
    front: "#1E88E5",
    side: "#0D47A1",
    abbr: "FO",
    isBarrel: false,
  },
  cocacola: {
    name: "Coca-Cola",
    top: "#FF5C4D",
    front: "#E4002B",
    side: "#A3001E",
    abbr: "CC",
    isBarrel: false,
  },
  vino: {
    name: "Vino",
    top: "#8E4585",
    front: "#5D1E4A",
    side: "#2D0F24",
    abbr: "VN",
    isBarrel: false,
  },
  licor: {
    name: "Licores",
    top: "#D4A574",
    front: "#A67C52",
    side: "#5D4037",
    abbr: "LI",
    isBarrel: false,
  },
  snacks: {
    name: "Snacks",
    top: "#FFCA28",
    front: "#FF8F00",
    side: "#E65100",
    abbr: "SN",
    isBarrel: false,
  },
  cafe: {
    name: "Cafe",
    top: "#6D4C41",
    front: "#4E342E",
    side: "#3E2723",
    abbr: "CF",
    isBarrel: false,
  },
  limpieza: {
    name: "Limpieza",
    top: "#B0BEC5",
    front: "#78909C",
    side: "#455A64",
    abbr: "LM",
    isBarrel: false,
  },
  barrilED30: {
    name: "Barril Estrella Damm 30L",
    top: "#9E9E9E",
    front: "#616161",
    side: "#424242",
    abbr: "B30",
    isBarrel: true,
  },
  barrilVollDamm: {
    name: "Barril Voll-Damm",
    top: "#5C5C5C",
    front: "#383838",
    side: "#212121",
    abbr: "BV",
    isBarrel: true,
  },
  barrilInedit: {
    name: "Barril Inedit",
    top: "#5C6BC0",
    front: "#3949AB",
    side: "#1A237E",
    abbr: "BI",
    isBarrel: true,
  },
  barrilTuria: {
    name: "Barril Turia",
    top: "#FF9800",
    front: "#E65100",
    side: "#BF360C",
    abbr: "BT",
    isBarrel: true,
  },
  barrilDammLemon: {
    name: "Barril Damm Lemon",
    top: "#FFF176",
    front: "#FDD835",
    side: "#F9A825",
    abbr: "BL",
    isBarrel: true,
  },
  retornable: {
    name: "Retornables",
    top: "#78909C",
    front: "#546E7A",
    side: "#37474F",
    abbr: "RET",
    isBarrel: false,
  },
} as const satisfies Record<string, Brand>;

export type BrandKey = keyof typeof BRANDS;

export const ACCENT_BY_TYPE: Record<string, string> = {
  Cajas: "#E30613",
  Mixto: "#16A34A",
  Barriles: "#5C6BC0",
  Retornables: "#00ACC1",
  Vacio: "#94A3B8",
};

export function familyToBrandKey(
  family: string,
  opts: { isKeg?: boolean } = {},
): BrandKey {
  if (opts.isKeg) {
    switch (family) {
      case "voll":
        return "barrilVollDamm";
      case "inedit":
        return "barrilInedit";
      case "turia":
        return "barrilTuria";
      case "damm_lemon":
        return "barrilDammLemon";
      default:
        return "barrilED30";
    }
  }

  switch (family) {
    case "estrella":
      return "estrellaDamm";
    case "voll":
      return "vollDamm";
    case "xibeca":
      return "xibeca";
    case "free":
      return "freeDamm";
    case "freetostada":
      return "freeDammTostada";
    case "daura":
      return "dauraDamm";
    case "damm_lemon":
      return "dammLemon";
    case "inedit":
      return "inedit";
    case "turia":
      return "turia";
    case "agua_veri":
      return "aguaVeri";
    case "vichy":
      return "vichy";
    case "font_dor":
      return "fontDor";
    case "cocacola":
      return "cocacola";
    case "cacaolat":
      return "cacaolat";
    case "letona":
      return "letona";
    case "vino":
      return "vino";
    case "licor":
      return "licor";
    case "snacks":
      return "snacks";
    case "cafe":
      return "cafe";
    case "limpieza":
      return "limpieza";
    case "unidad":
      return "limpieza";
    default:
      return "xibeca";
  }
}
