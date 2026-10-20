/**
 * Plazo de guardado de la selfie del álbum con fotos ocultas.
 *
 * Por defecto la selfie NO se guarda (null o 0). Si el fotógrafo configura un plazo,
 * nunca puede superar 90 días (coherente con el Consentimiento biométrico y la
 * Política de privacidad escolar). Puro, sin Prisma, para poder probarlo.
 */

export const HIDDEN_SELFIE_RETENTION_MAX_DAYS = 90;

/**
 * Normaliza lo que llega del formulario / API al valor a guardar en
 * `Album.hiddenSelfieRetentionDays`: null si está vacío o es inválido; si no,
 * un entero entre 0 y 90 (lo que pase de 90 queda en 90).
 */
export function parseHiddenSelfieRetentionDays(input: unknown): number | null {
  if (input === undefined || input === null || input === "") return null;
  const days = parseInt(String(input), 10);
  if (!Number.isFinite(days) || days < 0) return null;
  return Math.min(days, HIDDEN_SELFIE_RETENTION_MAX_DAYS);
}

/** Días efectivos de guardado al recibir una selfie (0 = no se guarda). */
export function effectiveHiddenSelfieRetentionDays(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), HIDDEN_SELFIE_RETENTION_MAX_DAYS);
}
