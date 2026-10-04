"use server";

import { listPublishedPosts } from "@repo/content";
import { requireWebsiteContext } from "@/lib/workspace";
import { blogScope } from "@/lib/blog/scope";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { postPath } from "@/lib/blog/public";
import { toBlogCard } from "@/lib/blog/public-format";
import type { BlogCardItem } from "@/lib/website/dynamic-data";

/**
 * Los artículos publicados de la institución, para elegir cuál destacar en una placa del banner.
 *
 * Solo los publicados: un borrador no tiene página a la que llevar. El orden es el del blog
 * público (el de carga), así el más reciente queda primero, como lo ve el visitante.
 */
export async function listBlogPostsForBannerAction(): Promise<{ posts: BlogCardItem[]; error: string | null }> {
  const { workspace } = await requireWebsiteContext();
  try {
    const slug = await loadPublicSlug(workspace.id);
    if (!slug) return { posts: [], error: "La institución todavía no tiene dirección pública para el sitio." };
    const posts = await listPublishedPosts({ ...blogScope(workspace.id), order: "createdAt", limit: 200 });
    return { posts: posts.map((p) => toBlogCard(p, postPath(slug, p.slug))), error: null };
  } catch (err) {
    console.error("[fotoffice][website] no se pudieron leer los artículos para el banner:", err);
    return { posts: [], error: "No pudimos leer los artículos del blog. Probá de nuevo en un rato." };
  }
}
