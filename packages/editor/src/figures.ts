import { sanitizeEditorialHtml } from "./sanitize";
import { markdownToEditorHtml } from "./markdown";

export type EditorialFigure = {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  assetId: string | null;
};

/**
 * Extrae figuras editoriales desde Markdown/HTML persistido.
 * Sirve para validar créditos antes de publicar (servidor).
 */
export function extractEditorialFigures(content: string): EditorialFigure[] {
  const html = markdownToEditorHtml(content);
  const safe = sanitizeEditorialHtml(html);
  const figures: EditorialFigure[] = [];

  const figureRe =
    /<figure\b[^>]*data-editorial-image[^>]*>([\s\S]*?)<\/figure>/gi;
  let match: RegExpExecArray | null;
  while ((match = figureRe.exec(safe)) !== null) {
    const block = match[0];
    const src = attr(block, "src") || imgSrc(block);
    const alt = imgAlt(block);
    const caption =
      attr(block, "data-caption") ||
      innerText(block, "data-caption") ||
      "";
    const credit =
      attr(block, "data-credit") ||
      innerText(block, "data-credit-text") ||
      "";
    const assetId = attr(block, "data-asset-id") || null;
    if (src) {
      figures.push({ src, alt, caption, credit, assetId });
    }
  }

  // Imágenes Markdown sueltas sin figure (legacy).
  const looseImgRe = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  const withoutFigures = safe.replace(figureRe, "");
  while ((imgMatch = looseImgRe.exec(withoutFigures)) !== null) {
    const tag = imgMatch[0];
    const src = attr(tag, "src");
    if (!src) continue;
    figures.push({
      src,
      alt: attr(tag, "alt") || "",
      caption: attr(tag, "title") || "",
      credit: "",
      assetId: null,
    });
  }

  return figures;
}

export function findFiguresMissingCredit(content: string): EditorialFigure[] {
  return extractEditorialFigures(content).filter((f) => !f.credit.trim());
}

export function findFiguresMissingAlt(content: string): EditorialFigure[] {
  return extractEditorialFigures(content).filter((f) => !f.alt.trim());
}

function attr(html: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return re.exec(html)?.[1]?.trim() || "";
}

function imgSrc(block: string): string {
  const m = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(block);
  return m?.[1]?.trim() || "";
}

function imgAlt(block: string): string {
  const m = /<img\b[^>]*\balt\s*=\s*["']([^"']*)["']/i.exec(block);
  return m?.[1]?.trim() || "";
}

function innerText(block: string, dataAttr: string): string {
  const re = new RegExp(
    `<[^>]+${dataAttr}[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i",
  );
  return re.exec(block)?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
}
