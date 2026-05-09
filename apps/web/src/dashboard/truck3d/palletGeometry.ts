/**
 * Geometria por defecto del palet 3D — extraida a fichero propio para
 * que React Fast Refresh no se queje (Vite obliga a que los modulos que
 * exportan componentes solo exporten componentes).
 */

export type PalletGeometry = {
  /** Anchura del palet (eje X mundo). */
  width: number;
  /** Profundidad del palet (eje Y mundo). */
  depth: number;
  /** Altura de la base de madera. */
  baseHeight: number;
  /** Tamano de cada box dentro de la pila. */
  boxWidth: number;
  boxDepth: number;
  boxHeight: number;
};

export const DEFAULT_GEOMETRY: PalletGeometry = {
  width: 60,
  depth: 80,
  baseHeight: 8,
  boxWidth: 26,
  boxDepth: 35,
  boxHeight: 22,
};
