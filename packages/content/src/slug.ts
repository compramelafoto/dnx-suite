const VALID_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SLUG_LEN = 3;
const MAX_SLUG_LEN = 60;

/** Normaliza texto a slug URL (NFD, lowercase, guiones). Autocontenido — no importa CLF. */
export function normalizeContentSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateContentSlugFormat(
  slug: string,
  reserved?: ReadonlySet<string>
): { ok: true } | { ok: false; error: string } {
  if (!slug) {
    return { ok: false, error: "El slug es requerido." };
  }
  if (slug.length < MIN_SLUG_LEN) {
    return { ok: false, error: `El slug debe tener al menos ${MIN_SLUG_LEN} caracteres.` };
  }
  if (slug.length > MAX_SLUG_LEN) {
    return { ok: false, error: `El slug no puede superar ${MAX_SLUG_LEN} caracteres.` };
  }
  if (!VALID_SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      error: "Solo letras minúsculas, números y guiones (sin espacios ni guiones al inicio/fin).",
    };
  }
  if (reserved?.has(slug)) {
    return { ok: false, error: "Esa URL está reservada por el sistema." };
  }
  return { ok: true };
}

export type ContentSlugValidationResult =
  | { ok: true; normalizedSlug: string }
  | { ok: false; normalizedSlug: string; error: string };

export function parseContentSlug(
  raw: string,
  reserved?: ReadonlySet<string>
): ContentSlugValidationResult {
  const normalizedSlug = normalizeContentSlug(raw);
  const format = validateContentSlugFormat(normalizedSlug, reserved);
  if (!format.ok) {
    return { ok: false, normalizedSlug, error: format.error };
  }
  return { ok: true, normalizedSlug };
}

export function slugifyFromName(name: string): string {
  return normalizeContentSlug(name);
}
