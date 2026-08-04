/**
 * Mapeo de la fila admin a los valores iniciales del formulario compartido.
 */
import { createEmptyContentJson, type AdminContentPostDetail } from "@repo/content";
import type { ContentPostFormValue } from "@repo/content-ui";

type ContentJson = ContentPostFormValue["contentJson"];

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function mapClickatonPostToFormValues(
  post: AdminContentPostDetail,
): Partial<ContentPostFormValue> {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || "",
    contentJson: (post.contentJson as ContentJson) || createEmptyContentJson(),
    heroImageUrl: post.heroImageUrl || "",
    status: post.status,
    type: post.type,
    categoryId: post.categoryId ? String(post.categoryId) : "",
    authorId: post.authorId ? String(post.authorId) : "",
    tagIds: (post.tags || []).map((tag) => tag.id),
    seoTitle: post.seoTitle || "",
    seoDescription: post.seoDescription || "",
    seoGoal: post.seoGoal || "",
    ogImageUrl: post.ogImageUrl || "",
    canonicalUrl: post.canonicalUrl || "",
    noIndex: post.noIndex,
    lastReviewedAt: toDateInputValue(post.lastReviewedAt),
    isFeatured: post.isFeatured,
    featuredUntil: toDateInputValue(post.featuredUntil),
  };
}
