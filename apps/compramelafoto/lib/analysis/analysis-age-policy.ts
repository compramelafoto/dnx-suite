/** Mensaje usado al suspender fotos antiguas del pipeline automático. */
export const ANALYSIS_SUSPENDED_BY_AGE_PREFIX =
  "Suspendida: subida hace más de";

export function analysisSuspendedByAgeMessage(days: number): string {
  return `${ANALYSIS_SUSPENDED_BY_AGE_PREFIX} ${days} días (prioridad a fotos recientes)`;
}

/**
 * Ventana de antigüedad máxima (días) para el cron/global.
 * - default 7
 * - 0 / negativo / "off" = sin límite
 */
export function resolveMaxPhotoAgeDays(): number | null {
  const raw = process.env.ANALYSIS_MAX_PHOTO_AGE_DAYS;
  if (raw == null || raw.trim() === "") return 7;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "off" || normalized === "none" || normalized === "false") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(3650, Math.floor(n));
}

export function photoCreatedAtCutoff(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
