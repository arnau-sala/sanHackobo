// Velocidad media por franja horaria para zona rural/interurbana (Osona, Vic)
// Zona urbana densa (Barcelona): multiplicadores distintos
const SPEED_BASE_KMH = 50; // velocidad base zona rural/interurbana

interface SpeedBand {
  fromMin: number;
  toMin: number;
  multiplier: number; // 1.0 = velocidad base, <1 = más lento
}

const RURAL_BANDS: SpeedBand[] = [
  { fromMin:  7 * 60, toMin:  8 * 60, multiplier: 0.95 }, // leve tráfico entrada
  { fromMin:  8 * 60, toMin:  9 * 60, multiplier: 0.80 }, // entrada a Vic, tráfico
  { fromMin:  9 * 60, toMin: 11 * 60, multiplier: 1.00 }, // fluido
  { fromMin: 11 * 60, toMin: 13 * 60, multiplier: 0.95 }, // ligero mediodía
  { fromMin: 13 * 60, toMin: 15 * 60, multiplier: 1.00 }, // fluido
  { fromMin: 15 * 60, toMin: 24 * 60, multiplier: 1.00 }, // fluido
];

const URBAN_BANDS: SpeedBand[] = [
  { fromMin:  7 * 60, toMin:  9 * 60, multiplier: 0.55 }, // punta mañana
  { fromMin:  9 * 60, toMin: 11 * 60, multiplier: 0.75 },
  { fromMin: 11 * 60, toMin: 14 * 60, multiplier: 0.90 },
  { fromMin: 14 * 60, toMin: 16 * 60, multiplier: 0.85 },
  { fromMin: 16 * 60, toMin: 20 * 60, multiplier: 0.65 }, // punta tarde
  { fromMin: 20 * 60, toMin: 24 * 60, multiplier: 0.95 },
];

function speedAt(departureMin: number, bands: SpeedBand[]): number {
  const band = bands.find((b) => departureMin >= b.fromMin && departureMin < b.toMin);
  return SPEED_BASE_KMH * (band?.multiplier ?? 1.0);
}

export function estimateTravelMinutes(
  distanceM: number,
  departureMin: number,
  zone: "rural" | "urban" = "rural"
): number {
  const speedKmh = speedAt(departureMin, zone === "urban" ? URBAN_BANDS : RURAL_BANDS);
  return (distanceM / 1000 / speedKmh) * 60;
}
