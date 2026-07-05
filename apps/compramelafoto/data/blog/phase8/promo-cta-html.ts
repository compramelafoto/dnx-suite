import type { EditorialPromoCta } from "@/data/blog/phase8/types";
import { sanitizeBlogHtml } from "@/lib/blog/generate-blog-html";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bloque CTA destacado al final de artículos editoriales (p. ej. ¿Cuánto Cobro?). */
export function buildBlogPromoCtaHtml(promo: EditorialPromoCta): string {
  const paragraphs = promo.paragraphs
    .map((text) => `<p class="blog-article-promo__text">${escapeHtml(text)}</p>`)
    .join("");
  const href = escapeHtml(promo.buttonHref);
  const label = escapeHtml(promo.buttonLabel);
  const title = escapeHtml(promo.title);

  const raw = `<div class="blog-article-promo">
  <h3 class="blog-article-promo__title">${title}</h3>
  ${paragraphs}
  <p class="blog-article-promo__action"><a class="blog-article-promo__button" href="${href}">${label}</a></p>
</div>`;

  return sanitizeBlogHtml(raw);
}
