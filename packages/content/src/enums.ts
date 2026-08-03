export const CONTENT_POST_STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const CONTENT_POST_TYPE_VALUES = ["BLOG", "FEATURE", "CASE_STUDY", "COMPARISON"] as const;

export type ContentPostStatusValue = (typeof CONTENT_POST_STATUS_VALUES)[number];
export type ContentPostTypeValue = (typeof CONTENT_POST_TYPE_VALUES)[number];

/** Alias CLF. */
export const BLOG_POST_STATUS_VALUES = CONTENT_POST_STATUS_VALUES;
export const BLOG_POST_TYPE_VALUES = CONTENT_POST_TYPE_VALUES;
export type BlogPostStatusValue = ContentPostStatusValue;
export type BlogPostTypeValue = ContentPostTypeValue;

export function parseContentPostStatusFilter(value: string | null): ContentPostStatusValue | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return (CONTENT_POST_STATUS_VALUES as readonly string[]).includes(normalized)
    ? (normalized as ContentPostStatusValue)
    : null;
}

export function parseContentPostTypeFilter(value: string | null): ContentPostTypeValue | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return (CONTENT_POST_TYPE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as ContentPostTypeValue)
    : null;
}

/** Alias CLF. */
export const parseBlogPostStatusFilter = parseContentPostStatusFilter;
export const parseBlogPostTypeFilter = parseContentPostTypeFilter;
