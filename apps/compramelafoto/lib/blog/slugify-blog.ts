import {
  normalizeContentSlug,
  parseContentSlug,
  slugifyFromName,
  validateContentSlugFormat,
  type ContentSlugValidationResult,
} from "@repo/content";
import {
  RESERVED_PUBLIC_SLUGS,
  type PublicSlugAvailabilityResult,
} from "@/lib/public-slugs";

/** Normaliza un texto a slug URL para entidades del blog. */
export function slugifyBlog(raw: string): string {
  return normalizeContentSlug(raw);
}

/** Valida formato de slug del blog (artículos, categorías, tags, autores). */
export function validateBlogSlug(
  slug: string
): { ok: true; normalizedSlug: string } | { ok: false; error: string } {
  const normalizedSlug = slugifyBlog(slug);
  const format = validateContentSlugFormat(normalizedSlug, RESERVED_PUBLIC_SLUGS);
  if (!format.ok) {
    return { ok: false, error: format.error };
  }
  return { ok: true, normalizedSlug };
}

/** Slug desde nombre legible (título, categoría, tag, autor). */
export function slugifyBlogFromName(name: string): string {
  return slugifyFromName(name);
}

export type BlogSlugValidationResult = ContentSlugValidationResult;

/**
 * Valida y normaliza slug; devuelve siempre el slug normalizado para mensajes de error consistentes.
 * Usa el set reservado de rutas públicas CLF.
 */
export function parseBlogSlug(raw: string): BlogSlugValidationResult {
  return parseContentSlug(raw, RESERVED_PUBLIC_SLUGS);
}

/** Alias tipado para reutilizar en APIs que ya usan PublicSlugAvailabilityResult. */
export type { PublicSlugAvailabilityResult };
