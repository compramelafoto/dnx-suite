import {
  normalizePublicSlug,
  validatePublicSlugFormat,
  type PublicSlugAvailabilityResult,
} from "@/lib/public-slugs";

/** Normaliza un texto a slug URL para entidades del blog. */
export function slugifyBlog(raw: string): string {
  return normalizePublicSlug(raw);
}

/** Valida formato de slug del blog (artículos, categorías, tags, autores). */
export function validateBlogSlug(slug: string): { ok: true; normalizedSlug: string } | { ok: false; error: string } {
  const normalizedSlug = slugifyBlog(slug);
  const format = validatePublicSlugFormat(normalizedSlug);
  if (!format.ok) {
    return { ok: false, error: format.error };
  }
  return { ok: true, normalizedSlug };
}

/** Slug desde nombre legible (título, categoría, tag, autor). */
export function slugifyBlogFromName(name: string): string {
  return slugifyBlog(name);
}

export type BlogSlugValidationResult =
  | { ok: true; normalizedSlug: string }
  | { ok: false; normalizedSlug: string; error: string };

/**
 * Valida y normaliza slug; devuelve siempre el slug normalizado para mensajes de error consistentes.
 */
export function parseBlogSlug(raw: string): BlogSlugValidationResult {
  const normalizedSlug = slugifyBlog(raw);
  const result = validateBlogSlug(normalizedSlug);
  if (!result.ok) {
    return { ok: false, normalizedSlug, error: result.error };
  }
  return { ok: true, normalizedSlug: result.normalizedSlug };
}

/** Alias tipado para reutilizar en APIs que ya usan PublicSlugAvailabilityResult. */
export type { PublicSlugAvailabilityResult };
