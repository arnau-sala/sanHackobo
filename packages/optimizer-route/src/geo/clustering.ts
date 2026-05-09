import { haversineDistance } from "./haversine";
import { EnrichedStop } from "../types/internal.types";
import { ClusterOutput } from "../types/output.types";

// Radio mayor en zona rural (stops están más separados, parking no es crítico)
// En zona urbana sería 120m; aquí 80m porque son pueblos distintos
const BASE_CLUSTER_RADIUS_M = 80;

// Si hay barriles pesados, reducimos el radio (el repartidor no puede caminar lejos)
function clusterRadius(barrelCount: number): number {
  if (barrelCount >= 2) return 50;
  if (barrelCount === 1) return 65;
  return BASE_CLUSTER_RADIUS_M;
}

export function clusterStops(enrichedStops: EnrichedStop[]): {
  clusters: ClusterOutput[];
  stopToCluster: Map<string, string>;
} {
  const clusters: ClusterOutput[] = [];
  const stopToCluster = new Map<string, string>();

  for (const es of enrichedStops) {
    const radius = clusterRadius(es.barrelCount);
    const existing = clusters.find((c) => {
      const anchor = enrichedStops.find((s) => s.stop.id === c.stopIds[0])!;
      return haversineDistance(es.stop.lat, es.stop.lng, anchor.stop.lat, anchor.stop.lng) <= radius;
    });

    if (existing) {
      const anchor = enrichedStops.find((s) => s.stop.id === existing.stopIds[0])!;
      const dist = haversineDistance(es.stop.lat, es.stop.lng, anchor.stop.lat, anchor.stop.lng);
      existing.walkingMeters = Math.max(existing.walkingMeters, dist);
      existing.stopIds.push(es.stop.id);
      stopToCluster.set(es.stop.id, existing.id);
    } else {
      const newCluster: ClusterOutput = {
        id: `cluster_${String(clusters.length + 1).padStart(2, "0")}`,
        parkingPointName: `${es.stop.address.split(",")[0]}, ${es.stop.city}`,
        stopIds: [es.stop.id],
        walkingMeters: 0,
        reason: "Único cliente en este radio",
      };
      clusters.push(newCluster);
      stopToCluster.set(es.stop.id, newCluster.id);
    }
  }

  for (const c of clusters) {
    if (c.stopIds.length > 1) {
      c.reason = `${c.stopIds.length} clientes a menos de ${BASE_CLUSTER_RADIUS_M}m — mismo punto de aparcamiento`;
    }
  }

  return { clusters, stopToCluster };
}
