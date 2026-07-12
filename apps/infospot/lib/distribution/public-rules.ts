/**
 * Regla pública central: solo PUBLISHED + REAL en superficies públicas / home.
 */

export const PUBLIC_CONTENT_STATUS = "PUBLISHED" as const;
export const PUBLIC_CONTENT_TAG = "REAL" as const;

export const NON_PUBLIC_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "READY_TO_PUBLISH",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export const NON_PUBLIC_TAGS = ["DEMO", "NEEDS_REVIEW"] as const;

/** Where Prisma reutilizable para eventos públicos. */
export function publicPublishedEventWhere(extra?: Record<string, unknown>) {
  return {
    status: PUBLIC_CONTENT_STATUS,
    contentTag: PUBLIC_CONTENT_TAG,
    excludeFromHomepage: false,
    ...extra,
  };
}

/** Where Prisma reutilizable para artículos públicos. */
export function publicPublishedArticleWhere(extra?: Record<string, unknown>) {
  return {
    status: PUBLIC_CONTENT_STATUS,
    contentTag: PUBLIC_CONTENT_TAG,
    excludeFromHomepage: false,
    ...extra,
  };
}

export function isPubliclyDistributable(input: {
  status?: string | null;
  contentTag?: string | null;
  excludeFromHomepage?: boolean | null;
}): boolean {
  if (input.status !== PUBLIC_CONTENT_STATUS) return false;
  if (input.contentTag !== PUBLIC_CONTENT_TAG) return false;
  if (input.excludeFromHomepage) return false;
  return true;
}
