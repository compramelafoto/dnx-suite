/**
 * Identificación de visitante para el conteo de vistas del blog Clickatón.
 * Cookie propia de app: no se comparte con CLF (`cmlf_blog_vid`).
 */

export const CLICKATON_BLOG_VISITOR_COOKIE = "clickaton_blog_visitor";

/** ~400 días: límite práctico de cookies persistentes en navegadores actuales. */
export const CLICKATON_BLOG_VISITOR_MAX_AGE = 60 * 60 * 24 * 400;

const MIN_VISITOR_KEY_LENGTH = 8;
const MAX_VISITOR_KEY_LENGTH = 64;

const RESERVED_BLOG_SEGMENTS = new Set(["categoria", "tag"]);

export function isClickatonBlogArticlePath(pathname: string): boolean {
  const slug = pathname.match(/^\/blog\/([^/]+)\/?$/)?.[1];
  if (!slug) return false;
  return !RESERVED_BLOG_SEGMENTS.has(slug);
}

export function resolveClickatonBlogVisitorKey(existingCookie: string | undefined): {
  visitorKey: string;
  isNew: boolean;
} {
  const trimmed = existingCookie?.trim() ?? "";
  if (trimmed.length >= MIN_VISITOR_KEY_LENGTH) {
    return { visitorKey: trimmed.slice(0, MAX_VISITOR_KEY_LENGTH), isNew: false };
  }
  return { visitorKey: crypto.randomUUID(), isNew: true };
}
