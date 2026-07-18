const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Normaliza texto a slug URL-safe (lowercase, guiones).
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Valida formato de slug (ya normalizado).
 */
export function isValidSlug(value: string): boolean {
  return value.length > 0 && SLUG_PATTERN.test(value);
}

/**
 * Normaliza slug entrante: trim + lowercase + colapsar guiones.
 */
export function normalizeSlug(value: string): string {
  return slugify(value);
}

export { SLUG_PATTERN };
