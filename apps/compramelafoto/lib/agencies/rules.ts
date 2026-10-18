import { haversineDistanceMeters } from "@/lib/geo";
import { isCoordPairValid } from "@/lib/geo/argentina-bounds";

/** Reglas puras del modo agencia: sin base de datos, para poder testearlas. */

export type AgencyMemberStatus = "REQUESTED" | "ACTIVE" | "REJECTED" | "REMOVED";

export const DEFAULT_COMMISSION_BPS = 3000;
const DEFAULT_RADIUS_KM = 50;

export const DEFAULT_AGENCY_TERMS = [
  "Al sumarte a esta agencia aceptás que:",
  "• Las fotos que subas a los álbumes de la agencia se venden sólo por ComprameLaFoto, al precio que fija la agencia.",
  "• Cobrás el porcentaje que la agencia te asigna sobre cada venta de tus fotos.",
  "• No vendés ni entregás por fuera de la plataforma fotos sacadas para la agencia.",
  "• No ves ni guardás datos de los clientes de la agencia.",
  "• La agencia puede darte de baja; tus fotos ya subidas siguen en sus álbumes.",
].join("\n");

export function parseCommissionPercent(
  input: unknown,
  opts: { allowEmpty?: boolean } = {}
): { ok: true; bps: number | null } | { ok: false; error: string } {
  const empty = input === null || input === undefined || (typeof input === "string" && input.trim() === "");
  if (empty) {
    return opts.allowEmpty ? { ok: true, bps: null } : { ok: false, error: "Poné un porcentaje." };
  }
  let n: number;
  if (typeof input === "number") n = input;
  else if (typeof input === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(input)) n = Number(input.trim().replace(",", "."));
  else return { ok: false, error: "El porcentaje tiene que ser un número, por ejemplo 30." };
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, error: "El porcentaje tiene que estar entre 0 y 100." };
  }
  return { ok: true, bps: Math.round(Math.round(n * 10) * 10) };
}

export function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(".", ",");
  return `${text} %`;
}

export function effectiveCommissionBps(
  member: { commissionBps: number | null },
  agency: { defaultCommissionBps: number }
): number {
  return member.commissionBps ?? agency.defaultCommissionBps;
}

export function resolveAgencyTerms(agency: { termsText: string | null }): string {
  const t = agency.termsText?.trim();
  return t ? t : DEFAULT_AGENCY_TERMS;
}

export function memberCanUpload(
  member: { status: string; termsVersionAccepted: number | null } | null,
  agency: { termsVersion: number }
): boolean {
  return Boolean(member && member.status === "ACTIVE" && member.termsVersionAccepted === agency.termsVersion);
}

export function memberNeedsTerms(
  member: { status: string; termsVersionAccepted: number | null },
  agency: { termsVersion: number }
): boolean {
  return member.status === "ACTIVE" && member.termsVersionAccepted !== agency.termsVersion;
}

export function planJoin(
  existing: { status: string } | null
): { action: "create" } | { action: "reactivate" } | { action: "request_again" } | { action: "already_active" } {
  if (!existing) return { action: "create" };
  if (existing.status === "ACTIVE") return { action: "already_active" };
  if (existing.status === "REMOVED") return { action: "request_again" };
  return { action: "reactivate" };
}

export function planRequest(
  existing: { status: string } | null
):
  | { action: "create" }
  | { action: "reopen" }
  | { action: "already_active" }
  | { action: "already_requested" } {
  if (!existing) return { action: "create" };
  if (existing.status === "ACTIVE") return { action: "already_active" };
  if (existing.status === "REQUESTED") return { action: "already_requested" };
  return { action: "reopen" };
}

export type AgencyInput = {
  name: string;
  description: string | null;
  defaultCommissionBps: number;
  directoryListed: boolean;
  directoryLat: number | null;
  directoryLng: number | null;
  directoryRadiusKm: number;
  directoryCity: string | null;
  notFoundSearchEnabled: boolean;
  termsText: string | null;
};

function optionalText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function validateAgencyInput(body: unknown): { ok: true; data: AgencyInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = optionalText(b.name, 120);
  if (!name) return { ok: false, error: "Poné el nombre de la agencia." };

  let defaultCommissionBps = DEFAULT_COMMISSION_BPS;
  if (b.defaultCommissionPercent !== undefined) {
    const p = parseCommissionPercent(b.defaultCommissionPercent);
    if (!p.ok) return p;
    defaultCommissionBps = p.bps as number;
  }

  const lat = optionalNumber(b.directoryLat);
  const lng = optionalNumber(b.directoryLng);
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat !== null) !== (lng !== null)) {
    return { ok: false, error: "La ubicación del mapa no es válida." };
  }
  if (lat !== null && lng !== null) {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || !isCoordPairValid(lat, lng)) {
      return { ok: false, error: "La ubicación del mapa no es válida." };
    }
  }

  const radiusRaw = optionalNumber(b.directoryRadiusKm);
  const directoryRadiusKm = radiusRaw === null ? DEFAULT_RADIUS_KM : Math.round(radiusRaw);
  if (Number.isNaN(radiusRaw) || directoryRadiusKm < 1 || directoryRadiusKm > 500) {
    return { ok: false, error: "El radio tiene que estar entre 1 y 500 km." };
  }

  const directoryListed = b.directoryListed === true;
  if (directoryListed && (lat === null || lng === null)) {
    return { ok: false, error: "Para aparecer en el directorio marcá tu zona en el mapa." };
  }

  return {
    ok: true,
    data: {
      name,
      description: optionalText(b.description, 600),
      defaultCommissionBps,
      directoryListed,
      directoryLat: lat,
      directoryLng: lng,
      directoryRadiusKm,
      directoryCity: optionalText(b.directoryCity, 120),
      notFoundSearchEnabled: b.notFoundSearchEnabled === true,
      termsText: optionalText(b.termsText, 4000),
    },
  };
}

export function sortByDistanceKm<T extends { lat: number; lng: number }>(
  items: T[],
  from: { lat: number; lng: number }
): Array<T & { distanceKm: number }> {
  return items
    .map((it) => ({ ...it, distanceKm: haversineDistanceMeters(from.lat, from.lng, it.lat, it.lng) / 1000 }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
