/**
 * Proyeccion isometrica simple en coordenadas SVG.
 *
 * Sistema de mundo:
 *   +x  → derecha del camion (de cabina hacia trasera)
 *   +y  → fondo del camion   (lateral derecho hacia lateral izquierdo)
 *   +z  → arriba             (suelo hacia techo)
 *
 * Camara: angulo isometrico clasico (30°).
 *   screenX = (x - y) * cos30
 *   screenY = (x + y) * sin30 - z
 *
 * Resultado: el viewer ve el camion desde el frente-superior-derecho, con la
 * cabina al fondo y el lateral derecho/trasera abiertos hacia nosotros.
 */

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.8660
const SIN30 = Math.sin(Math.PI / 6); // 0.5

export type World = { x: number; y: number; z: number };
export type Screen = { x: number; y: number };

export function project({ x, y, z }: World): Screen {
  return {
    x: (x - y) * COS30,
    y: (x + y) * SIN30 - z,
  };
}

/** Convierte una lista de puntos del mundo en un atributo `points` de polygon. */
export function polygonPoints(corners: World[]): string {
  return corners.map((c) => screenString(project(c))).join(" ");
}

export function screenString({ x, y }: Screen): string {
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

/**
 * Devuelve los 4 vertices superiores de un cuboide axis-aligned.
 *   origin = esquina inferior-trasera-izquierda
 */
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

/** Cara frontal del cuboide (la que mira hacia y mas pequena). */
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

/** Cara lateral derecha del cuboide (x = origin.x + w). */
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

/** Cara lateral izquierda del cuboide (x = origin.x). */
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

/** Cara trasera del cuboide (y = origin.y + d). */
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

/**
 * Para ordenar polygons por profundidad: cuanto mayor sea (x + y + z) en
 * el centro del polygon, mas cerca esta del viewer y mas tarde se debe
 * pintar. Devuelve la "depth key".
 */
export function depthKey(p: World): number {
  return p.x + p.y - p.z * 0.4;
}
