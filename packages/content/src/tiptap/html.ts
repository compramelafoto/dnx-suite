import type { JSONContent } from "@tiptap/core";
import sanitizeHtml from "sanitize-html";
import { downgradeH1InContentJson } from "./content-utils";

const CONTENT_HTML_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "s",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "iframe",
  "figure",
  "figcaption",
  "hr",
  "code",
  "pre",
] as const;

const CONTENT_HTML_ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "loading",
  "decoding",
  "class",
  "colspan",
  "rowspan",
  "data-youtube-video",
  "allow",
  "allowfullscreen",
  "frameborder",
  "referrerpolicy",
] as const;

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...CONTENT_HTML_ALLOWED_TAGS],
  allowedAttributes: Object.fromEntries(
    CONTENT_HTML_ALLOWED_TAGS.map((tag) => [tag, [...CONTENT_HTML_ALLOWED_ATTR]])
  ),
  allowVulnerableTags: false,
};

/**
 * Sanitiza HTML generado desde TipTap antes de persistir o renderizar.
 */
export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Alias CLF. */
export const sanitizeBlogHtml = sanitizeContentHtml;

/**
 * Genera HTML seguro desde contentJson (fuente de verdad).
 * Carga TipTap bajo demanda (compatible con serverless / Vercel).
 */
export async function generateContentHtml(contentJson: JSONContent): Promise<string> {
  const [{ generateHTML }, { getContentTiptapExtensions }] = await Promise.all([
    import("@tiptap/html"),
    import("./extensions"),
  ]);
  const normalized = downgradeH1InContentJson(contentJson);
  const rawHtml = generateHTML(normalized, getContentTiptapExtensions());
  return sanitizeContentHtml(rawHtml);
}

/** Alias CLF. */
export const generateBlogHtml = generateContentHtml;
