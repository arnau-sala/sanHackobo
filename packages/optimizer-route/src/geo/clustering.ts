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

  // centroid: lat/lng/count viven aquí durante la construcción
  const centroids = new Map<string, { lat: number; lng: number; count: number }>();

  for (const es of enrichedStops) {
    const radius = clusterRadius(es.barrelCount);
    const existing = clusters.find((c) => {
      const cen = centroids.get(c.id)!;
      return haversineDistance(es.stop.lat, es.stop.lng, cen.lat, cen.lng) <= radius;
    });

    if (existing) {
      const cen = centroids.get(existing.id)!;
      const newCount = cen.count + 1;
      cen.lat = (cen.lat * cen.count + es.stop.lat) / newCount;
      cen.lng = (cen.lng * cen.count + es.stop.lng) / newCount;
      cen.count = newCount;
      // walkingMeters = distancia más larga desde centroide hasta cualquier stop del cluster
      const dist = haversineDistance(es.stop.lat, es.stop.lng, cen.lat, cen.lng);
      existing.walkingMeters = Math.max(existing.walkingMeters, dist);
      // Actualizar centroid en ClusterOutput
      existing.centroidLat = cen.lat;
      existing.centroidLng = cen.lng;
      existing.stopIds.push(es.stop.id);
      stopToCluster.set(es.stop.id, existing.id);
    } else {
      const newCluster: ClusterOutput = {
        id: `cluster_${String(clusters.length + 1).padStart(2, "0")}`,
        // Nombre provisional — se sobreescribe con reverseGeocode tras geocodeTransporte
        parkingPointName: `${es.stop.address.split(",")[0].trim()}, ${es.stop.city}`,
        centroidLat: es.stop.lat,
        centroidLng: es.stop.lng,
        stopIds: [es.stop.id],
        walkingMeters: 0,
        reason: "Único cliente en este radio",
      };
      clusters.push(newCluster);
      centroids.set(newCluster.id, { lat: es.stop.lat, lng: es.stop.lng, count: 1 });
      stopToCluster.set(es.stop.id, newCluster.id);
    }
  }

  for (const c of clusters) {
    if (c.stopIds.length > 1) {
      c.reason = `${c.stopIds.length} clientes en radio de ${BASE_CLUSTER_RADIUS_M}m — mismo punto de aparcamiento`;
    }
  }

  return { clusters, stopToCluster };
}
