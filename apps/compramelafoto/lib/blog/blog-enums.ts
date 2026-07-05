/** Valores de enum del blog (evitar z.nativeEnum con @prisma/client en rutas API). */
export const BLOG_POST_STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const BLOG_POST_TYPE_VALUES = ["BLOG", "FEATURE", "CASE_STUDY", "COMPARISON"] as const;

export type BlogPostStatusValue = (typeof BLOG_POST_STATUS_VALUES)[number];
export type BlogPostTypeValue = (typeof BLOG_POST_TYPE_VALUES)[number];

export function parseBlogPostStatusFilter(value: string | null): BlogPostStatusValue | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return (BLOG_POST_STATUS_VALUES as readonly string[]).includes(normalized)
    ? (normalized as BlogPostStatusValue)
    : null;
}

export function parseBlogPostTypeFilter(value: string | null): BlogPostTypeValue | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return (BLOG_POST_TYPE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as BlogPostTypeValue)
    : null;
}
