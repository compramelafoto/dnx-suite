/**
 * Normaliza un string para usarlo como slug.
 * Minúsculas, espacios a guiones, solo alfanuméricos y guiones.
 */
export function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
