import type { RoutePlan } from "../types.js";

/**
 * Mock RoutePlan basado en una ruta tipo de DR0027:
 *   - Bloque A (1-4): Sant Julià de Vilatorta (4 clientes).
 *   - Bloque B (5-8): Calldetenes centro (4 clientes).
 *   - Bloque C (9-12): Calldetenes carretera + Folgueroles centro (4 clientes).
 *   - Bloque D (13-14): Folgueroles fin de ruta (2 clientes).
 *
 * El compañero de ruta (Persona 2) generará uno equivalente con coordenadas
 * y ETA reales. Aquí solo necesitamos sequence + stopId para el motor.
 */

export const mockRoutePlan: RoutePlan = {
  id: "route-DR0027-2026-05-08",
  totalStops: 14,
  estimatedKm: 38.4,
  estimatedMinutes: 240,
  stops: [
    {
      sequence: 1,
      stopId: "stop-01",
      clientName: "BAR PAVELLO ST JULIA VILATORTA",
      clusterId: "cluster-sj",
      arrivalEta: "08:45",
      serviceMinutes: 12,
      reasoning: ["Bar grande con time window 08:30-11:00", "Cluster Sant Julià"],
    },
    {
      sequence: 2,
      stopId: "stop-04",
      clientName: "BAR NURIA ST.JULIA VILATORTA",
      clusterId: "cluster-sj",
      arrivalEta: "09:00",
      serviceMinutes: 10,
    },
    {
      sequence: 3,
      stopId: "stop-02",
      clientName: "BAR EL TUPÍ",
      clusterId: "cluster-sj",
      arrivalEta: "09:15",
      serviceMinutes: 8,
    },
    {
      sequence: 4,
      stopId: "stop-05",
      clientName: "CAL TEIXIDOR",
      clusterId: "cluster-sj",
      arrivalEta: "09:30",
      serviceMinutes: 12,
    },

    {
      sequence: 5,
      stopId: "stop-03",
      clientName: "MAS L' ALBAREDA",
      clusterId: "cluster-sj-out",
      arrivalEta: "09:55",
      serviceMinutes: 18,
    },
    {
      sequence: 6,
      stopId: "stop-08",
      clientName: "SUKIPA",
      clusterId: "cluster-call",
      arrivalEta: "10:25",
      serviceMinutes: 10,
    },
    {
      sequence: 7,
      stopId: "stop-07",
      clientName: "CELLER CALLDETENES",
      clusterId: "cluster-call",
      arrivalEta: "10:40",
      serviceMinutes: 8,
    },
    {
      sequence: 8,
      stopId: "stop-11",
      clientName: "CA LA NENA",
      clusterId: "cluster-call",
      arrivalEta: "10:55",
      serviceMinutes: 10,
    },

    {
      sequence: 9,
      stopId: "stop-06",
      clientName: "RESTAURANT EL ROSER",
      clusterId: "cluster-call-pau",
      arrivalEta: "11:15",
      serviceMinutes: 8,
    },
    {
      sequence: 10,
      stopId: "stop-09",
      clientName: "BAR DE LA BENZINERA",
      clusterId: "cluster-n141",
      arrivalEta: "11:35",
      serviceMinutes: 14,
    },
    {
      sequence: 11,
      stopId: "stop-10",
      clientName: "BAR DE LA BENZINERA HIGIENE",
      clusterId: "cluster-n141",
      arrivalEta: "11:50",
      serviceMinutes: 6,
    },
    {
      sequence: 12,
      stopId: "stop-12",
      clientName: "BAR KARNAK",
      clusterId: "cluster-folg",
      arrivalEta: "12:15",
      serviceMinutes: 10,
    },

    {
      sequence: 13,
      stopId: "stop-13",
      clientName: "L'ESPAI RESTAURANT",
      clusterId: "cluster-folg",
      arrivalEta: "12:35",
      serviceMinutes: 10,
    },
    {
      sequence: 14,
      stopId: "stop-14",
      clientName: "LA COCA DE FOLGUEROLES",
      clusterId: "cluster-folg",
      arrivalEta: "12:50",
      serviceMinutes: 6,
      reasoning: ["Última parada del día", "Cluster Folgueroles"],
    },
  ],
  clusters: [
    {
      id: "cluster-sj",
      stopIds: ["stop-01", "stop-04", "stop-02", "stop-05"],
      parkingPointName: "Plaça Sant Julià",
      walkingMeters: 80,
      reason: "4 bares en radio < 200m, una sola parada de camión",
    },
    {
      id: "cluster-call",
      stopIds: ["stop-08", "stop-07", "stop-11"],
      parkingPointName: "Carrer Gran Calldetenes",
      walkingMeters: 60,
      reason: "Carrer Gran 1, 9 y 20",
    },
    {
      id: "cluster-n141",
      stopIds: ["stop-09", "stop-10"],
      parkingPointName: "Gasolinera N-141",
      walkingMeters: 0,
      reason: "Mismo edificio, dos albaranes",
    },
    {
      id: "cluster-folg",
      stopIds: ["stop-12", "stop-13", "stop-14"],
      parkingPointName: "Plaça Mossèn Cinto Verdaguer",
      walkingMeters: 120,
      reason: "Centro Folgueroles",
    },
  ],
};
