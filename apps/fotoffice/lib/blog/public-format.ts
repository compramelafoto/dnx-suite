import type { BlogCardItem } from "@/lib/website/dynamic-data";

/**
 * Lo puro del blog público: fechas, tarjetas, RSS y la llave de visitante. Sin base ni request,
 * para poder probarlo entero (ver `public-format.test.ts`) y para que lo usen tanto las páginas
 * como la ruta del RSS y la de vistas sin arrastrar `server-only`.
 */

const ZONA_AR = "America/Argentina/Buenos_Aires";

function aFecha(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "28 de diciembre de 2025", siempre en hora argentina. Sin la zona explícita, un artículo
 * publicado a las 22 h se vería con la fecha del día siguiente: el servidor corre en UTC.
 */
export function formatBlogDate(value: Date | string | null | undefined): string | null {
  const date = aFecha(value);
  if (!date) return null;
  return date.toLocaleDateString("es-AR", { timeZone: ZONA_AR, day: "numeric", month: "long", year: "numeric" });
}

/**
 * La dirección absoluta de algo del sitio. Las portadas viven en R2 y ya vienen absolutas; una
 * relativa (`/algo.jpg`) se completa con la dirección de la app. Sin dirección configurada se
 * devuelve tal cual: inventar un dominio sería peor que un enlace relativo.
 */
export function absoluteUrl(base: string, pathOrUrl: string | null | undefined): string | null {
  const value = pathOrUrl?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const limpio = base.replace(/\/+$/, "");
  return `${limpio}${value.startsWith("/") ? value : `/${value}`}`;
}

/** Lo mínimo de un artículo que hace falta para su tarjeta. Coincide con el listado del motor. */
export type BlogCardSource = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  publishedAt: Date | string | null;
  category: { name: string } | null;
};

export function toBlogCard(post: BlogCardSource, href: string): BlogCardItem {
  const date = aFecha(post.publishedAt);
  return {
    id: post.id,
    href,
    title: post.title,
    excerpt: post.excerpt?.trim() || null,
    imageUrl: post.heroImageUrl?.trim() || null,
    categoryName: post.category?.name ?? null,
    dateLabel: formatBlogDate(date),
    dateIso: date ? date.toISOString() : null,
  };
}

/** Escapa los cinco caracteres que rompen un XML. El título de un artículo puede traer `&`. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type BlogRssItem = {
  title: string;
  url: string;
  description: string | null;
  publishedAt: Date | string | null;
  category: string | null;
};

/**
 * El RSS 2.0 del blog. A mano y no con una librería: son veinte líneas y así no se suma una
 * dependencia al lockfile que comparten todas las apps.
 *
 * La descripción va escapada, no en CDATA: es el extracto (texto plano), y escapar cubre el caso
 * borde de un extracto que contenga `]]>`, que dentro de un CDATA cortaría el documento.
 */
export function buildBlogRssXml(input: {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  items: BlogRssItem[];
}): string {
  const items = input.items
    .map((item) => {
      const date = aFecha(item.publishedAt);
      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
        item.description ? `      <description>${escapeXml(item.description)}</description>` : null,
        item.category ? `      <category>${escapeXml(item.category)}</category>` : null,
        date ? `      <pubDate>${date.toUTCString()}</pubDate>` : null,
        "    </item>",
      ]
        .filter((line): line is string => line !== null)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${escapeXml(input.siteUrl)}</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    "    <language>es-AR</language>",
    `    <atom:link href="${escapeXml(input.feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...(items ? [items] : []),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

/**
 * Cookie del visitante del blog, para contar una vista por persona y no una por recarga.
 * Mismo criterio que Clickatón (`apps/clickaton/lib/content/visitor.ts`), con una diferencia:
 * acá cada institución tiene su blog, así que la cookie se limita a la ruta que registra las
 * vistas de ESA institución (ver `blogViewsCookiePath`). Dos blogs no comparten visitante.
 */
export const BLOG_VISITOR_COOKIE = "fo_blog_visitor";

/** ~400 días: el tope práctico de una cookie persistente en los navegadores de hoy. */
export const BLOG_VISITOR_MAX_AGE = 60 * 60 * 24 * 400;

const MIN_VISITOR_KEY = 8;
const MAX_VISITOR_KEY = 64;

/**
 * La única ruta que lee la cookie es la que registra la vista. La página del artículo no la
 * necesita (no puede escribir cookies: un Server Component sólo lee), así que ni siquiera se le
 * manda: la cookie vive acotada a `/api/w/<slug>/blog`.
 */
export const blogViewsPath = (workspaceSlug: string) => `/api/w/${workspaceSlug}/blog/views`;
export const blogViewsCookiePath = (workspaceSlug: string) => `/api/w/${workspaceSlug}/blog`;

export function resolveBlogVisitorKey(existing: string | undefined): { visitorKey: string; isNew: boolean } {
  const trimmed = existing?.trim() ?? "";
  if (trimmed.length >= MIN_VISITOR_KEY) return { visitorKey: trimmed.slice(0, MAX_VISITOR_KEY), isNew: false };
  return { visitorKey: crypto.randomUUID(), isNew: true };
}

/**
 * Minutos de lectura. El motor ya lo calcula al guardar (`readingTimeMin`); esto es sólo el
 * respaldo para artículos importados sin ese dato: ~200 palabras por minuto, mínimo uno.
 */
export function readingMinutes(readingTimeMin: number | null | undefined, html: string): number {
  if (readingTimeMin && readingTimeMin > 0) return readingTimeMin;
  const palabras = html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}

/**
 * Las pastillas de categorías del listado: "Todos" primero y después las categorías que tienen
 * al menos un artículo publicado (una categoría vacía llevaría a una página vacía). El orden es
 * el que les dio la institución en el panel, que ya viene resuelto de la consulta.
 */
export function buildCategoryChips(
  blogHref: string,
  categories: ReadonlyArray<{ slug: string; name: string; _count: { posts: number } }>,
  activeSlug: string | null,
): Array<{ href: string; label: string; active: boolean }> {
  return [
    { href: blogHref, label: "Todos", active: activeSlug === null },
    ...categories
      .filter((c) => c._count.posts > 0)
      .map((c) => ({ href: `${blogHref}/categoria/${c.slug}`, label: c.name, active: c.slug === activeSlug })),
  ];
}

/**
 * El artículo que va grande arriba del listado: el marcado como destacado si hay uno, si no el
 * primero. El resto conserva el orden en que vino (el de carga, ver `lib/blog/public.ts`).
 */
export function splitFeatured<T extends { id: number; isFeatured: boolean }>(posts: readonly T[]): { featured: T | null; rest: T[] } {
  const featured = posts.find((p) => p.isFeatured) ?? posts[0] ?? null;
  return { featured, rest: featured ? posts.filter((p) => p.id !== featured.id) : [] };
}

/**
 * Slugs que un artículo no puede usar porque ya son rutas del blog: `/blog/categoria/...`,
 * `/blog/tag/...` y `/blog/rss.xml` ganan sobre `/blog/[slug]`, así que un artículo llamado
 * "categoria" quedaría inalcanzable. Lo consume la validación del editor al guardar
 * (`validateContentSlugFormat(slug, BLOG_RESERVED_POST_SLUGS)` de `@repo/content`).
 */
export const BLOG_RESERVED_POST_SLUGS: ReadonlySet<string> = new Set(["categoria", "tag", "rss"]);
