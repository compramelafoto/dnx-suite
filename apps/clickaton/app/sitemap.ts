import type { MetadataRoute } from "next";
import { routes } from "@/config/navigation";
import {
  blogCategoryPath,
  blogHomePath,
  blogPostPath,
  blogTagPath,
} from "@/lib/content/content-site-config";
import { getClickatonBlogSitemapEntries } from "@/lib/content/public-queries";
import { resolveContentSearchIndexing } from "@/lib/content/search-indexing";
import {
  PRODUCTION_SITE_ORIGIN,
  resolveClickatonPublicOrigin,
} from "@/lib/site/public-origin";

const STATIC_PATHS: readonly string[] = [
  routes.home,
  routes.marathons,
  routes.howItWorks,
  routes.community,
  routes.organize,
  routes.joinUs,
  routes.about,
  routes.contact,
  routes.store,
  routes.brandManual,
  blogHomePath(),
];

function absolute(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Sitemap Clickatón — entradas estáticas + blog CMS (`platform = clickaton`).
 * Staging: vacío (noindex) vía resolveContentSearchIndexing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const indexing = resolveContentSearchIndexing();
  if (!indexing.allowIndexing) {
    return [];
  }

  const origin = /maratonfotografica\.com/i.test(indexing.origin)
    ? PRODUCTION_SITE_ORIGIN
    : resolveClickatonPublicOrigin();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: absolute(origin, path),
    changeFrequency: path === routes.home ? "weekly" : "monthly",
    priority: path === routes.home ? 1 : 0.7,
  }));

  try {
    const blog = await getClickatonBlogSitemapEntries();
    for (const post of blog.posts) {
      entries.push({
        url: absolute(origin, blogPostPath(post.slug)),
        lastModified: post.lastReviewedAt ?? post.updatedAt ?? undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
    for (const category of blog.categories) {
      entries.push({
        url: absolute(origin, blogCategoryPath(category.slug)),
        lastModified: category.updatedAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
    for (const tag of blog.tags) {
      entries.push({
        url: absolute(origin, blogTagPath(tag.slug)),
        changeFrequency: "weekly",
        priority: 0.4,
      });
    }
  } catch {
    /* sitemap estático si el CMS no está disponible */
  }

  return entries;
}
