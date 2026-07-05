/** Cookie persistente para identificar al visitante del blog entre sesiones. */
export const BLOG_VISITOR_COOKIE_NAME = "cmlf_blog_vid";

/** Header interno inyectado por middleware (no exponer al cliente). */
export const BLOG_VISITOR_HEADER = "x-blog-visitor-key";

const RESERVED_BLOG_SEGMENTS = new Set(["categoria", "tag"]);

export const BLOG_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~400 días

export function isBlogArticlePath(pathname: string): boolean {
  const match = pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (!match?.[1]) return false;
  return !RESERVED_BLOG_SEGMENTS.has(match[1]);
}

export function resolveBlogVisitorKey(existingCookie: string | undefined): {
  visitorKey: string;
  isNew: boolean;
} {
  const trimmed = existingCookie?.trim() ?? "";
  if (trimmed.length >= 8) {
    return { visitorKey: trimmed.slice(0, 64), isNew: false };
  }
  return { visitorKey: crypto.randomUUID(), isNew: true };
}
