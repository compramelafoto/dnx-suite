export const BLOG_POSTS_PER_PAGE = 9;

export function parseBlogPageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function getBlogTotalPages(totalItems: number, perPage = BLOG_POSTS_PER_PAGE): number {
  if (totalItems <= 0) return 1;
  return Math.ceil(totalItems / perPage);
}

export function clampBlogPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

export function sliceBlogPage<T>(items: T[], page: number, perPage = BLOG_POSTS_PER_PAGE): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function blogPageHref(page: number, anchor = "blog-articles"): string {
  const base = page <= 1 ? "/blog" : `/blog?page=${page}`;
  return anchor ? `${base}#${anchor}` : base;
}

export function blogPageRangeLabel(
  page: number,
  totalItems: number,
  perPage = BLOG_POSTS_PER_PAGE
): string {
  if (totalItems === 0) return "Sin artículos";
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalItems);
  if (start === end) return `Artículo ${start} de ${totalItems}`;
  return `Artículos ${start}–${end} de ${totalItems}`;
}

/** Ventana de números de página para la UI (con elipsis). */
export function getBlogPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}
