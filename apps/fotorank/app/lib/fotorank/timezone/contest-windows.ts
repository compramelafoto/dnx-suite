/**
 * Ventanas de inscripción/carga con timezone IANA del concurso.
 * Argentina (Cordoba/Buenos_Aires) = UTC-3 fijo (sin DST).
 * No depende del TZ del proceso para las comparaciones UTC almacenadas.
 */
export const SANTA_FE_DEFAULT_TIMEZONE = "America/Argentina/Cordoba";

/** Offset fijo documentado para zonas AR usadas por FotoRank. */
const FIXED_OFFSET_HOURS: Record<string, number> = {
  "America/Argentina/Cordoba": -3,
  "America/Argentina/Buenos_Aires": -3,
};

export function resolveContestTimezone(tz?: string | null): string {
  return (tz && tz.trim()) || SANTA_FE_DEFAULT_TIMEZONE;
}

/**
 * Interpreta un wall-clock local (YYYY-MM-DDTHH:mm:ss) en la TZ del concurso → Date UTC.
 */
export function contestLocalToUtc(isoLocal: string, timeZone: string): Date {
  const offsetH = FIXED_OFFSET_HOURS[timeZone];
  if (offsetH == null) {
    // Fallback: tratar como UTC e indicar en docs que solo AR fijas están garantizadas aquí.
    return new Date(`${isoLocal}Z`);
  }
  // local = utc + offset → utc = local - offset
  const asUtc = new Date(`${isoLocal}Z`);
  return new Date(asUtc.getTime() - offsetH * 3600_000);
}

export function isInstantInWindow(input: {
  now: Date;
  opensAt: Date | null;
  closesAt: Date | null;
}): "before_open" | "open" | "after_close" {
  const { now, opensAt, closesAt } = input;
  if (opensAt && now.getTime() < opensAt.getTime()) return "before_open";
  // cierre: el instante exacto de closesAt sigue abierto; un ms después cierra
  if (closesAt && now.getTime() > closesAt.getTime()) return "after_close";
  return "open";
}

export function formatInContestTimezone(date: Date, timeZone: string): string {
  const offsetH = FIXED_OFFSET_HOURS[timeZone] ?? 0;
  const local = new Date(date.getTime() + offsetH * 3600_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const ss = String(local.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}
