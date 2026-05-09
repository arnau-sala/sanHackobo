/**
 * Proyeccion isometrica adoptada del export del Figma (interfaz_camion).
 *
 * Sistema de mundo:
 *   +x  → derecha del camion (lateral izquierdo de la carga)
 *   +y  → fondo del camion   (de cabina hacia trasera)
 *   +z  → arriba             (suelo hacia techo)
 *
 * Camara: angulo isometrico clasico (30°), con escala fija para que las
 * coordenadas caigan dentro del viewBox 680x400 sin recalcular nada.
 *
 *   screenX = OX + (x - y) * SCALE * cos30
 *   screenY = OY + (x + y) * SCALE * sin30 - z * SCALE
 *
 * Mantenemos los nombres `project`, `polygonPoints`, etc. por
 * compatibilidad con el resto del codigo del demo.
 */

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.8660
const SIN30 = 0.5;

export const SCALE = 24;
export const OX = 342;
export const OY = 150;

export type World = { x: number; y: number; z: number };
export type Screen = { x: number; y: number };

export function project({ x, y, z }: World): Screen {
  return {
    x: OX + (x - y) * SCALE * COS30,
    y: OY + (x + y) * SCALE * SIN30 - z * SCALE,
  };
}

/** Atajo estilo Figma export: `iso(x,y,z)` → `[screenX, screenY]`. */
export function iso(x: number, y: number, z: number): [number, number] {
  return [
    OX + (x - y) * SCALE * COS30,
    OY + (x + y) * SCALE * SIN30 - z * SCALE,
  ];
}

/** Forma `points` para un `<polygon>` SVG a partir de tuplas (sx,sy). */
export function pts(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Variante con World[]: util para el codigo legacy. */
export function polygonPoints(corners: World[]): string {
  return corners.map((c) => screenString(project(c))).join(" ");
}

export function screenString({ x, y }: Screen): string {
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

/** Devuelve los 4 vertices superiores de un cuboide axis-aligned. */
export function cuboidTopFace(
  origin: World,
  w: number,
  d: number,
  h: number,
): World[] {
  const z = origin.z + h;
  return [
    { x: origin.x, y: origin.y, z },
    { x: origin.x + w, y: origin.y, z },
    { x: origin.x + w, y: origin.y + d, z },
    { x: origin.x, y: origin.y + d, z },
  ];
}

export function cuboidFrontFace(
  origin: World,
  w: number,
  _d: number,
  h: number,
): World[] {
  return [
    { x: origin.x, y: origin.y, z: origin.z },
    { x: origin.x + w, y: origin.y, z: origin.z },
    { x: origin.x + w, y: origin.y, z: origin.z + h },
    { x: origin.x, y: origin.y, z: origin.z + h },
  ];
}

export function cuboidRightFace(
  origin: World,
  w: number,
  d: number,
  h: number,
): World[] {
  return [
    { x: origin.x + w, y: origin.y, z: origin.z },
    { x: origin.x + w, y: origin.y + d, z: origin.z },
    { x: origin.x + w, y: origin.y + d, z: origin.z + h },
    { x: origin.x + w, y: origin.y, z: origin.z + h },
  ];
}

export function cuboidLeftFace(
  origin: World,
  _w: number,
  d: number,
  h: number,
): World[] {
  return [
    { x: origin.x, y: origin.y, z: origin.z },
    { x: origin.x, y: origin.y + d, z: origin.z },
    { x: origin.x, y: origin.y + d, z: origin.z + h },
    { x: origin.x, y: origin.y, z: origin.z + h },
  ];
}

export function cuboidBackFace(
  origin: World,
  w: number,
  d: number,
  h: number,
): World[] {
  return [
    { x: origin.x, y: origin.y + d, z: origin.z },
    { x: origin.x + w, y: origin.y + d, z: origin.z },
    { x: origin.x + w, y: origin.y + d, z: origin.z + h },
    { x: origin.x, y: origin.y + d, z: origin.z + h },
  ];
}

export function depthKey(p: World): number {
  return p.x + p.y - p.z * 0.4;
}
