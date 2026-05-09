/** Coordenadas de zonas de carga/descarga por parada [dLng, dLat] offset desde el cliente */
export const PARK_OFFSETS: Record<string, [number, number]> = {
  "stop-01": [ 0.00008, -0.00022],
  "stop-02": [ 0.00009, -0.00020],
  "stop-03": [ 0.00008, -0.00020],
  "stop-04": [ 0.00009, -0.00019],
  "stop-05": [ 0.00011,  0.00013],
  "stop-06": [ 0.00014, -0.00022],
  "stop-07": [ 0.00013, -0.00019],
  "stop-08": [ 0.00013, -0.00019],
  "stop-09": [ 0.00014, -0.00019],
  "stop-10": [ 0.00013, -0.00016],
  "stop-11": [ 0.00013, -0.00019],
  "stop-12": [ 0.00011, -0.00016],
  "stop-13": [ 0.00011, -0.00016],
  "stop-14": [ 0.00011, -0.00016],
};

export type LngLat = [number, number]; // [lng, lat]

export function parkingCoord(stopId: string, lat: number, lng: number): LngLat {
  const [dLng, dLat] = PARK_OFFSETS[stopId] ?? [0.00010, -0.00018];
  return [lng + dLng, lat + dLat];
}
