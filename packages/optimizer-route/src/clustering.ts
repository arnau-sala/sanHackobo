import { haversineDistance } from "./geo";

const CLUSTER_RADIUS_M = 120;

export interface Stop {
  id: string;
  lat: number;
  lng: number;
  address: string;
  [key: string]: unknown;
}

export interface Cluster {
  id: string;
  parkingPointName: string;
  stopIds: string[];
  walkingMeters: number;
  reason: string;
}

export function clusterStops(stops: Stop[]): {
  clusters: Cluster[];
  stopToCluster: Map<string, string>;
} {
  const clusters: Cluster[] = [];
  const stopToCluster = new Map<string, string>();

  for (const stop of stops) {
    const existing = clusters.find((c) => {
      const anchor = stops.find((s) => s.id === c.stopIds[0])!;
      return haversineDistance(stop.lat, stop.lng, anchor.lat, anchor.lng) <= CLUSTER_RADIUS_M;
    });

    if (existing) {
      const anchor = stops.find((s) => s.id === existing.stopIds[0])!;
      const dist = haversineDistance(stop.lat, stop.lng, anchor.lat, anchor.lng);
      existing.walkingMeters = Math.max(existing.walkingMeters, dist);
      existing.stopIds.push(stop.id);
      stopToCluster.set(stop.id, existing.id);
    } else {
      const newCluster: Cluster = {
        id: `cluster_${String(clusters.length + 1).padStart(2, "0")}`,
        parkingPointName: `C/D ${stop.address.split(",")[0]}`,
        stopIds: [stop.id],
        walkingMeters: 0,
        reason: "Punto único en este radio",
      };
      clusters.push(newCluster);
      stopToCluster.set(stop.id, newCluster.id);
    }
  }

  for (const c of clusters) {
    if (c.stopIds.length > 1) {
      c.reason = `${c.stopIds.length} clientes servibles desde el mismo punto de aparcamiento`;
    }
  }

  return { clusters, stopToCluster };
}
