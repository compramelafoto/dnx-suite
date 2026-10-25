import { parseCuantoCobroAmount } from "../amount-format";
import { CUANTO_COBRO_ROUTE_FACTOR, type CuantoCobroPricingExtras } from "./types";

const num = (v: string | undefined): number | null => (v === undefined || v.trim() === "" ? null : parseCuantoCobroAmount(v));

/** Distancia en línea recta (haversine), en km. */
export function straightLineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function coord(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type TravelInput = {
  distanceKm?: string;
  travelZoneId?: string;
  jobLatitude?: string;
  jobLongitude?: string;
};

export type TravelResult = { km: number; mode: "per_km" | "zones"; zoneName: string | null; cost: number; warnings: string[] };

/** Distancia de ida: la cargada o, si no, la línea recta × 1,3 desde el estudio. */
export function resolveDistanceKm(extras: CuantoCobroPricingExtras, input: TravelInput): number | null {
  const given = num(input.distanceKm);
  if (given !== null && given >= 0) return given;
  const [sLat, sLng, jLat, jLng] = [coord(extras.studioLatitude), coord(extras.studioLongitude), coord(input.jobLatitude), coord(input.jobLongitude)];
  if (sLat === null || sLng === null || jLat === null || jLng === null) return null;
  return Math.round(straightLineKm(sLat, sLng, jLat, jLng) * CUANTO_COBRO_ROUTE_FACTOR * 10) / 10;
}

/** Viáticos del trabajo (costo, sin ganancia ni recargos). null si no corresponde. */
export function computeTravel(extras: CuantoCobroPricingExtras, input: TravelInput): TravelResult | null {
  if (extras.travelMode === "per_km") {
    const perKm = num(extras.travelPerKm) ?? 0;
    const km = resolveDistanceKm(extras, input);
    if (km === null || perKm <= 0) return null;
    const free = num(extras.travelFreeKm) ?? 0;
    const billable = Math.max(0, km * 2 - free);
    return { km, mode: "per_km", zoneName: null, cost: Math.round(billable * perKm), warnings: [] };
  }
  if (extras.travelMode === "zones") {
    const zones = (extras.travelZones ?? [])
      .map((z) => ({ ...z, limit: num(z.upToKm), price: num(z.amount) ?? 0 }))
      .filter((z) => z.limit !== null)
      .sort((a, b) => a.limit! - b.limit!);
    if (zones.length === 0) return null;
    if (input.travelZoneId) {
      const z = zones.find((x) => x.id === input.travelZoneId);
      if (z) return { km: resolveDistanceKm(extras, input) ?? z.limit!, mode: "zones", zoneName: z.name, cost: Math.round(z.price), warnings: [] };
    }
    const km = resolveDistanceKm(extras, input);
    if (km === null) return null;
    const z = zones.find((x) => km <= x.limit!);
    if (z) return { km, mode: "zones", zoneName: z.name, cost: Math.round(z.price), warnings: [] };
    const last = zones[zones.length - 1]!;
    return {
      km,
      mode: "zones",
      zoneName: last.name,
      cost: Math.round(last.price),
      warnings: [`El evento queda más lejos que tu última zona (${last.name}): usé su precio. Revisá los viáticos.`],
    };
  }
  return null;
}
