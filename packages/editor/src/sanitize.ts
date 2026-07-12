import sanitizeHtml from "sanitize-html";

export const EDITORIAL_HTML_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "img",
  "figure",
  "figcaption",
  "span",
  "hr",
] as const;

export const EDITORIAL_HTML_ALLOWED_ATTR: Record<string, string[]> = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title", "loading", "decoding"],
  figure: ["class", "data-editorial-image", "data-credit", "data-caption", "data-asset-id"],
  figcaption: ["class"],
  span: ["class", "data-caption", "data-credit-text"],
  p: ["class"],
  h2: ["class"],
  h3: ["class"],
  blockquote: ["class"],
  ul: ["class"],
  ol: ["class"],
  li: ["class"],
  hr: ["class"],
};

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...EDITORIAL_HTML_ALLOWED_TAGS],
  allowedAttributes: EDITORIAL_HTML_ALLOWED_ATTR,
  allowedSchemes: ["http", "https", "mailto"],
  allowVulnerableTags: false,
  transformTags: {
    b: "strong",
    i: "em",
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

/** Sanitiza HTML del editor antes de persistir o renderizar. */
export function sanitizeEditorialHtml(html: string): string {
  return sanitizeHtml(html || "", SANITIZE_OPTIONS);
}

/**
 * Limpia HTML pegado (Google Docs / Word): conserva estructura básica,
 * elimina estilos, clases basura y atributos inseguros.
 */
export function sanitizePastedHtml(html: string): string {
  const cleaned = sanitizeHtml(html || "", {
    ...SANITIZE_OPTIONS,
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
    ],
    allowedAttributes: {
      a: ["href"],
    },
    transformTags: {
      h1: "h2",
      h4: "h3",
      b: "strong",
      i: "em",
      span: "span",
      div: "p",
    },
  });

  // Quitar spans vacíos residuales.
  return cleaned.replace(/<\/?span>/g, "");
}
