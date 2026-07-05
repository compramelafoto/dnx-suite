import type { PublicBlogPostSearchItem } from "@/lib/blog/public-queries";

export type BlogQuickFilter = {
  id: string;
  label: string;
  query?: string;
  categorySlug?: string;
};

/** Atajos estratégicos alineados con intents del blog. */
export const BLOG_QUICK_FILTERS: BlogQuickFilter[] = [
  { id: "referidos", label: "Referidos", query: "referidos" },
  { id: "escuelas", label: "Escuelas", query: "escolar" },
  { id: "organizadores", label: "Organizadores", query: "organizador" },
  { id: "selfie", label: "Selfie", query: "selfie" },
  { id: "comparativas", label: "Comparativas", categorySlug: "comparativas" },
  { id: "mercado-pago", label: "Mercado Pago", query: "mercado pago" },
];

export function normalizeBlogSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function postSearchHaystack(post: PublicBlogPostSearchItem): string {
  const tagNames = post.tags.map((row) => row.tag.name);
  return normalizeBlogSearchText(
    [post.title, post.excerpt ?? "", post.category?.name ?? "", ...tagNames].join(" ")
  );
}

export type BlogSearchFilters = {
  query: string;
  categorySlug: string | null;
};

export function isBlogSearchActive(filters: BlogSearchFilters): boolean {
  return Boolean(filters.query.trim() || filters.categorySlug);
}

export function filterBlogPosts(
  posts: PublicBlogPostSearchItem[],
  filters: BlogSearchFilters
): PublicBlogPostSearchItem[] {
  const tokens = normalizeBlogSearchText(filters.query)
    .split(/\s+/)
    .filter(Boolean);

  return posts.filter((post) => {
    if (filters.categorySlug && post.category?.slug !== filters.categorySlug) {
      return false;
    }
    if (tokens.length === 0) return true;
    const haystack = postSearchHaystack(post);
    return tokens.every((token) => haystack.includes(token));
  });
}

export function quickFilterIsActive(
  filter: BlogQuickFilter,
  filters: BlogSearchFilters
): boolean {
  if (filter.categorySlug) {
    return filters.categorySlug === filter.categorySlug && !filters.query.trim();
  }
  if (filter.query) {
    return (
      normalizeBlogSearchText(filters.query) === normalizeBlogSearchText(filter.query) &&
      !filters.categorySlug
    );
  }
  return false;
}
