/**
 * Validación sintáctica de slugs públicos V1.
 * Alineada con `normalizeSlug` (a-z, 0-9, guiones).
 */

const PUBLIC_EVENT_SLUG_MAX_LENGTH = 100;
const PUBLIC_EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Devuelve true si el slug es sintácticamente válido para la API pública.
 * No consulta la base de datos.
 */
export function isValidPublicEventSlugV1(slug: unknown): slug is string {
  if (typeof slug !== "string") return false;
  const value = slug.trim();
  if (value.length < 1 || value.length > PUBLIC_EVENT_SLUG_MAX_LENGTH) {
    return false;
  }
  if (value !== slug) {
    // Espacios extremos o segmentos no trim: inválido en URL pública.
    return false;
  }
  return PUBLIC_EVENT_SLUG_PATTERN.test(value);
}

export function assertPublicEventSlugV1(slug: unknown): string | null {
  if (!isValidPublicEventSlugV1(slug)) return null;
  return slug;
}
