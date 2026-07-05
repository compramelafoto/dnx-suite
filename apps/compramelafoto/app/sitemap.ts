import type { MetadataRoute } from "next";
import { getDefaultSitemapOrigin } from "@/lib/blog/blog-metadata";
import {
  getBlogSitemapEntries,
  PUBLIC_STATIC_SITEMAP_PATHS,
} from "@/lib/blog/sitemap-data";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getDefaultSitemapOrigin();
  const { posts, categories, tags } = await getBlogSitemapEntries();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_SITEMAP_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/blog" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/blog" ? 0.9 : 0.6,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${origin}/blog/${encodeURIComponent(post.slug)}`,
    lastModified: post.lastReviewedAt || post.updatedAt || post.publishedAt || new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${origin}/blog/categoria/${encodeURIComponent(category.slug)}`,
    lastModified: category.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const tagEntries: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${origin}/blog/tag/${encodeURIComponent(tag.slug)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...postEntries, ...categoryEntries, ...tagEntries];
}
