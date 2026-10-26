import type { WebsiteBlock, WebsiteSections } from "./blocks";
import { RESERVED_SITE_SEGMENTS } from "./reserved-slugs";

/** Clave de la página de inicio dentro de `sectionsJson.pages`. Nunca tiene `pageMeta`. */
export const HOME_PAGE_KEY = "home";

/** Largo máximo del slug que se arma a partir del título. */
const SLUG_MAX_LENGTH = 60;

/** Letras minúsculas/números separados por guiones simples, sin guiones al borde. */
const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Páginas propias (todas menos el inicio), en el orden en que se crearon. */
export function listCustomPages(
  s: WebsiteSections,
): Array<{ key: string; slug: string; title: string; seoTitle?: string; seoDescription?: string }> {
  return Object.entries(s.pageMeta).map(([key, meta]) => ({ key, ...meta }));
}

export function findPageBySlug(
  s: WebsiteSections,
  slug: string,
): { key: string; meta: WebsiteSections["pageMeta"][string]; blocks: WebsiteBlock[] } | null {
  for (const [key, meta] of Object.entries(s.pageMeta)) {
    if (meta.slug === slug) return { key, meta, blocks: s.pages[key] ?? [] };
  }
  return null;
}

/** Devuelve el mensaje de error para mostrar al usuario, o `null` si la dirección sirve.
 * `others` son los slugs de las demás páginas propias (sin incluir la que se está editando). */
export function validatePageSlug(slug: string, others: string[]): string | null {
  if (!SLUG_FORMAT.test(slug) || slug.length > SLUG_MAX_LENGTH) {
    return "Usá sólo letras minúsculas, números y guiones (por ejemplo: quien-soy)";
  }
  if (RESERVED_SITE_SEGMENTS.includes(slug)) return "Esa dirección ya la usa el sitio";
  if (others.includes(slug)) return "Ya hay otra página con esa dirección";
  return null;
}

/** Arma una dirección a partir de un título: sin tildes ni signos, en minúsculas y con guiones. */
export function slugifyPageTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}
