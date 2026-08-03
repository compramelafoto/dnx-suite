import type { ContentPostFormSubmitPayload, ContentPostFormValue } from "../types";
import { syncContentPostImageFields } from "./syncImages";

export function buildContentPostSubmitPayload(
  form: ContentPostFormValue,
  statusOverride?: ContentPostFormValue["status"]
): ContentPostFormSubmitPayload {
  const images = syncContentPostImageFields({
    heroImageUrl: form.heroImageUrl,
    ogImageUrl: form.ogImageUrl,
  });
  const status = statusOverride ?? form.status;
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim() || null,
    contentJson: form.contentJson,
    heroImageUrl: images.heroImageUrl,
    status,
    type: form.type,
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    authorId: form.authorId ? Number(form.authorId) : null,
    tagIds: form.tagIds,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    seoGoal: form.seoGoal.trim() || null,
    ogImageUrl: images.ogImageUrl,
    canonicalUrl: form.canonicalUrl.trim() || null,
    noIndex: form.noIndex,
    lastReviewedAt: form.lastReviewedAt ? new Date(form.lastReviewedAt).toISOString() : null,
    isFeatured: status === "PUBLISHED" ? form.isFeatured : false,
    featuredUntil: form.featuredUntil ? new Date(form.featuredUntil).toISOString() : null,
  };
}

export function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
