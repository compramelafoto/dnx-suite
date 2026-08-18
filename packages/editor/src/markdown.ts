import { marked } from "marked";
import TurndownService from "turndown";
import { sanitizeEditorialHtml } from "./sanitize";

marked.setOptions({
  gfm: true,
  breaks: false,
});

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    bulletListMarker: "-",
  });

  // Conservar figuras editoriales como HTML (crédito/epígrafe no caben en MD puro).
  service.addRule("editorialFigure", {
    filter: (node) =>
      node.nodeName === "FIGURE" &&
      (node as HTMLElement).getAttribute("data-editorial-image") === "true",
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      return `\n\n${el.outerHTML}\n\n`;
    },
  });

  // Conservar bloques de galería como HTML (N fotos con metadata estructurada).
  service.addRule("editorialGalleryFigure", {
    filter: (node) =>
      node.nodeName === "FIGURE" &&
      (node as HTMLElement).getAttribute("data-editorial-gallery") === "true",
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      return `\n\n${el.outerHTML}\n\n`;
    },
  });

  service.addRule("editorialVideo", {
    filter: (node) =>
      node.nodeName === "FIGURE" &&
      (node as HTMLElement).getAttribute("data-editorial-video") === "true",
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      return `\n\n${el.outerHTML}\n\n`;
    },
  });

  service.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => content,
  });

  return service;
}

/**
 * Markdown (legacy o generado) → HTML sanitizado para TipTap `setContent`.
 */
export function markdownToEditorHtml(markdown: string): string {
  const raw = String(markdown || "").trim();
  if (!raw) return "<p></p>";

  // Si ya es HTML de figura / párrafos tipados, sanitizar directo.
  if (looksLikeHtmlDocument(raw)) {
    return sanitizeEditorialHtml(raw);
  }

  const html = marked.parse(raw, { async: false }) as string;
  return sanitizeEditorialHtml(html);
}

/**
 * HTML del editor → Markdown compatible (figuras como HTML islands).
 */
export function editorHtmlToMarkdown(html: string): string {
  const safe = sanitizeEditorialHtml(html);
  if (!safe.trim() || safe === "<p></p>") return "";
  const service = createTurndown();
  return service.turndown(safe).trim();
}

function looksLikeHtmlDocument(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("<") &&
    /<(p|h2|h3|ul|ol|blockquote|figure|hr)\b/i.test(trimmed)
  );
}

/** Texto plano para contadores y validación de placeholders. */
export function htmlToPlainText(html: string): string {
  return sanitizeEditorialHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[23]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWordsFromHtml(html: string): number {
  const text = htmlToPlainText(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function countWordsFromMarkdown(markdown: string): number {
  return countWordsFromHtml(markdownToEditorHtml(markdown));
}
