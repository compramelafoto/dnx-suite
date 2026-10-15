/**
 * Las secciones del panel del blog y cuál está activa según la dirección.
 *
 * Artículos ocupa la raíz (`/website/blog`), el alta (`/nuevo`) y la edición (`/<id>`): las
 * tres son "estar trabajando en artículos". El resto son prefijos simples.
 */
export const BLOG_ADMIN_BASE = "/website/blog";

export type BlogAdminSection = "posts" | "categorias" | "tags" | "autores" | "media";

export const BLOG_ADMIN_SECTIONS: readonly { key: BlogAdminSection; label: string; href: string }[] = [
  { key: "posts", label: "Artículos", href: BLOG_ADMIN_BASE },
  { key: "categorias", label: "Categorías", href: `${BLOG_ADMIN_BASE}/categorias` },
  { key: "tags", label: "Tags", href: `${BLOG_ADMIN_BASE}/tags` },
  { key: "autores", label: "Autores", href: `${BLOG_ADMIN_BASE}/autores` },
  { key: "media", label: "Imágenes", href: `${BLOG_ADMIN_BASE}/media` },
];

export function blogAdminSectionFor(pathname: string): BlogAdminSection | null {
  if (pathname !== BLOG_ADMIN_BASE && !pathname.startsWith(`${BLOG_ADMIN_BASE}/`)) return null;
  const segmento = pathname.slice(BLOG_ADMIN_BASE.length + 1).split("/")[0] ?? "";
  switch (segmento) {
    case "categorias":
    case "tags":
    case "autores":
    case "media":
      return segmento;
    default:
      return "posts";
  }
}

/** Dominio propio del sitio: también tiene ítem propio en el menú lateral. */
export const WEBSITE_DOMAIN_PATH = "/website/dominio";

export function isDomainNavActive(pathname: string): boolean {
  return pathname === WEBSITE_DOMAIN_PATH || pathname.startsWith(`${WEBSITE_DOMAIN_PATH}/`);
}

/** Para el menú lateral: "Sitio web" no se marca adentro del blog ni del dominio, que tienen su
 * propio ítem. */
export function isWebsiteNavActive(pathname: string): boolean {
  const enSitio = pathname === "/website" || pathname.startsWith("/website/");
  return enSitio && blogAdminSectionFor(pathname) === null && !isDomainNavActive(pathname);
}

export function isBlogNavActive(pathname: string): boolean {
  return blogAdminSectionFor(pathname) !== null;
}
