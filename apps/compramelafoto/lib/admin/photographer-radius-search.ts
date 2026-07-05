import { haversineDistanceMeters } from "@/lib/geo";

export type PhotographerRadiusSearchCenter = {
  lat: number;
  lng: number;
  label: string;
};

export type WithDistanceKm<T> = T & { distanceKm: number };

export function photographersWithinRadiusKm<T extends { latitude: number; longitude: number }>(
  photographers: T[],
  center: PhotographerRadiusSearchCenter,
  radiusKm: number
): WithDistanceKm<T>[] {
  const radiusM = radiusKm * 1000;
  return photographers
    .map((p) => {
      const distM = haversineDistanceMeters(center.lat, center.lng, p.latitude, p.longitude);
      return { photographer: p, distM, distanceKm: Math.round((distM / 1000) * 10) / 10 };
    })
    .filter((row) => row.distM <= radiusM)
    .sort((a, b) => a.distM - b.distM)
    .map(({ photographer, distanceKm }) => ({ ...photographer, distanceKm }));
}
