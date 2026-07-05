import type { EditorialPromoCta } from "@/data/blog/phase8/types";
import { sanitizeBlogHtml } from "@/lib/blog/generate-blog-html";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bloque CTA destacado al final de un artículo del blog. */
export function buildBlogPromoCtaHtml(promo: EditorialPromoCta): string {
  const paragraphs = promo.paragraphs
    .map((paragraph) => `<p class="blog-article-promo__text">${escapeHtml(paragraph)}</p>`)
    .join("");

  const raw = `<aside class="blog-article-promo" aria-label="${escapeHtml(promo.title)}">
  <h3 class="blog-article-promo__title">${escapeHtml(promo.title)}</h3>
  ${paragraphs}
  <p class="blog-article-promo__action">
    <a href="${escapeHtml(promo.buttonHref)}" class="blog-article-promo__button">${escapeHtml(promo.buttonLabel)}</a>
  </p>
</aside>`;

  return sanitizeBlogHtml(raw);
}
