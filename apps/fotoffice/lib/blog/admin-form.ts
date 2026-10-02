import { createEmptyContentJson, type AdminContentPostDetail } from "@repo/content";
import type { ContentPostFormValue } from "@repo/content-ui";

/**
 * De la fila del artículo a los valores iniciales del formulario compartido (`ContentPostForm`).
 */
type ContentJson = ContentPostFormValue["contentJson"];

const ZONA_AR = "America/Argentina/Buenos_Aires";

/**
 * Una fecha para un `<input type="date">` (AAAA-MM-DD) en hora argentina.
 *
 * `toISOString().slice(0, 10)` da el día en UTC: algo revisado a las 22 h de Buenos Aires
 * aparecía como del día siguiente. `en-CA` es el formato que coincide con el del input.
 */
export function toDateInputValueAr(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: ZONA_AR });
}

export function mapBlogPostToFormValues(post: AdminContentPostDetail): Partial<ContentPostFormValue> {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || "",
    contentJson: (post.contentJson as ContentJson) || createEmptyContentJson(),
    heroImageUrl: post.heroImageUrl || "",
    status: post.status,
    type: post.type,
    categoryId: post.categoryId ? String(post.categoryId) : "",
    // Sin autor es válido: el primer artículo de una institución puede salir antes de cargar autores.
    authorId: post.authorId ? String(post.authorId) : "",
    tagIds: (post.tags || []).map((tag) => tag.id),
    seoTitle: post.seoTitle || "",
    seoDescription: post.seoDescription || "",
    seoGoal: post.seoGoal || "",
    ogImageUrl: post.ogImageUrl || "",
    canonicalUrl: post.canonicalUrl || "",
    noIndex: post.noIndex,
    lastReviewedAt: toDateInputValueAr(post.lastReviewedAt),
    isFeatured: post.isFeatured,
    featuredUntil: toDateInputValueAr(post.featuredUntil),
  };
}
