import { distanceKm } from "@repo/geo";
import type { ActivityType } from "./constants";
import { temporalStatus } from "./dates";

type Coords = { latitude: number; longitude: number };

export function withDistance<A extends { latitude: number | null; longitude: number | null }>(
  origin: Coords,
  items: A[],
): (A & { distanceKm: number | null })[] {
  return items
    .map((a) => ({
      ...a,
      distanceKm:
        a.latitude == null || a.longitude == null
          ? null
          : Math.round(distanceKm(origin, { latitude: a.latitude, longitude: a.longitude }) * 10) / 10,
    }))
    .sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity));
}

export type PublicFilter = { province?: string; type?: ActivityType; openNow?: boolean; includeClosed?: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function applyFilter<A extends { province: string | null; type: string; startsAt: Date; endsAt: Date }>(
  items: A[],
  f: PublicFilter,
  now: Date,
): A[] {
  return items.filter((a) => {
    const t = temporalStatus(a, now);
    if (!f.includeClosed && t === "CLOSED") return false;
    if (f.openNow && t !== "OPEN") return false;
    if (f.type && a.type !== f.type) return false;
    if (f.province && fold(a.province ?? "") !== fold(f.province)) return false;
    return true;
  });
}
