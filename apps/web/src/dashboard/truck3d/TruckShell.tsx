/**
 * Caja del camion (chasis + cabina) en isometrico.
 *
 * Se compone de:
 *   - Suelo gris claro (rectangulo proyectado).
 *   - Pared trasera (fondo, lateral izquierdo) blanca con linea sup roja.
 *   - Tope rojo (techo) inclinado.
 *   - Cabina al fondo-derecha (cubo rojo).
 *
 * El lateral derecho y la trasera quedan abiertos para que se vean los
 * palets desde fuera.
 */
import {
  cuboidBackFace,
  cuboidLeftFace,
  cuboidTopFace,
  polygonPoints,
  type World,
} from "./projection";

export type TruckShellProps = {
  /** Esquina inferior-trasera-izquierda del CARGO box. */
  origin: World;
  /** Dimensiones del box de carga. */
  width: number;
  depth: number;
  height: number;
  /** Tamaño de la cabina (en unidades de mundo). */
  cabLength?: number;
};

const FLOOR_FILL = "#f1f5f9";
const FLOOR_LINE = "#cbd5e1";
const WALL_BACK = "#ffffff";
const WALL_LEFT = "#f8fafc";
const ROOF = "#e10600";
const ROOF_DARK = "#b00500";
const CAB = "#e10600";
const CAB_DARK = "#a00400";
const CAB_GLASS = "#1f2a44";

export function TruckShell({
  origin,
  width: w,
  depth: d,
  height: h,
  cabLength = 90,
}: TruckShellProps) {
  // Suelo: cara superior del cuboide a z=0.
  const floor = cuboidTopFace(origin, w, d, 0);
  // Pared trasera (mas alejada en y).
  const back = cuboidBackFace(origin, w, d, h);
  // Pared izquierda (eje x = origin.x).
  const left = cuboidLeftFace(origin, w, d, h);
  // Techo: cara superior del cuboide a z=h.
  const roof = cuboidTopFace(origin, w, d, h);

  // Cabina: a +x del cargo box, mas baja.
  const cabOrigin: World = { x: origin.x + w, y: origin.y, z: origin.z };
  const cabH = h * 0.85;
  const cabFront = [
    { x: cabOrigin.x + cabLength, y: cabOrigin.y, z: cabOrigin.z },
    { x: cabOrigin.x + cabLength, y: cabOrigin.y + d, z: cabOrigin.z },
    { x: cabOrigin.x + cabLength, y: cabOrigin.y + d, z: cabOrigin.z + cabH },
    { x: cabOrigin.x + cabLength, y: cabOrigin.y, z: cabOrigin.z + cabH },
  ];
  const cabRight = [
    { x: cabOrigin.x, y: cabOrigin.y, z: cabOrigin.z },
    { x: cabOrigin.x + cabLength, y: cabOrigin.y, z: cabOrigin.z },
    { x: cabOrigin.x + cabLength, y: cabOrigin.y, z: cabOrigin.z + cabH },
    { x: cabOrigin.x, y: cabOrigin.y, z: cabOrigin.z + cabH },
  ];
  const cabTop = cuboidTopFace(cabOrigin, cabLength, d, cabH);

  // "Cristal" del lateral de la cabina.
  const glassWidth = cabLength * 0.55;
  const glassHeight = cabH * 0.45;
  const glass = [
    { x: cabOrigin.x + cabLength * 0.25, y: cabOrigin.y, z: cabOrigin.z + cabH * 0.3 },
    { x: cabOrigin.x + cabLength * 0.25 + glassWidth, y: cabOrigin.y, z: cabOrigin.z + cabH * 0.3 },
    { x: cabOrigin.x + cabLength * 0.25 + glassWidth, y: cabOrigin.y, z: cabOrigin.z + cabH * 0.3 + glassHeight },
    { x: cabOrigin.x + cabLength * 0.25, y: cabOrigin.y, z: cabOrigin.z + cabH * 0.3 + glassHeight },
  ];

  return (
    <g data-truck-shell>
      {/* Suelo */}
      <polygon
        points={polygonPoints(floor)}
        fill={FLOOR_FILL}
        stroke={FLOOR_LINE}
        strokeWidth={0.6}
      />
      {/* Pared izquierda */}
      <polygon
        points={polygonPoints(left)}
        fill={WALL_LEFT}
        stroke="#cbd5e144"
        strokeWidth={0.4}
      />
      {/* Pared trasera */}
      <polygon
        points={polygonPoints(back)}
        fill={WALL_BACK}
        stroke="#cbd5e144"
        strokeWidth={0.4}
      />
      {/* Techo */}
      <polygon
        points={polygonPoints(roof)}
        fill={ROOF}
        stroke={ROOF_DARK}
        strokeWidth={0.6}
      />

      {/* Cabina */}
      <polygon
        points={polygonPoints(cabRight)}
        fill={CAB_DARK}
        stroke="#0f172a33"
        strokeWidth={0.6}
      />
      <polygon
        points={polygonPoints(cabFront)}
        fill={CAB}
        stroke="#0f172a33"
        strokeWidth={0.6}
      />
      <polygon
        points={polygonPoints(cabTop)}
        fill={ROOF_DARK}
        stroke="#0f172a33"
        strokeWidth={0.6}
      />
      <polygon
        points={polygonPoints(glass)}
        fill={CAB_GLASS}
        stroke="#0f172a55"
        strokeWidth={0.4}
      />

      {/* Marcas en suelo: lineas guia entre filas y columnas */}
      <polygon
        points={polygonPoints(cuboidTopFace(
          { x: origin.x, y: origin.y + d * 0.5 - 0.4, z: origin.z + 0.05 },
          w,
          0.8,
          0,
        ))}
        fill={FLOOR_LINE}
        opacity={0.6}
      />
    </g>
  );
}
