import "server-only";
import { blogPath, listBlogPosts, listBlogPostsByIds, postPath } from "@/lib/blog/public";
import { toBlogCard } from "@/lib/blog/public-format";
import type { PublicSite } from "./public-site";
import { blogLatestLimitFor, type WebsiteDynamicData } from "./dynamic-data";
import { heroBlogPostIdsFor } from "./blocks";

/**
 * Lee lo que piden los bloques dinámicos de una página publicada, y nada más: si la página no
 * tiene "Últimos artículos" ni placas que destaquen un artículo, el blog ni se consulta. Corre en el servidor del sitio público;
 * el builder no la llama (ver `dynamic-data.ts`).
 *
 * Si una lectura falla, ese bloque recibe una lista vacía y no se dibuja: un problema del blog
 * no puede tirar la portada entera de la institución.
 */
export async function loadWebsiteDynamicData(site: PublicSite, blocks: PublicSite["homeBlocks"]): Promise<WebsiteDynamicData> {
  const data: WebsiteDynamicData = {};
  const blog = { workspaceId: site.workspaceId, slug: site.workspaceSlug, nombre: site.commercialName, logoUrl: site.logoUrl };

  const blogLimit = blogLatestLimitFor(blocks);
  if (blogLimit > 0) {
    const posts = await listBlogPosts(blog, { limit: blogLimit }).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer los últimos artículos:", err);
      return [];
    });
    data.blogLatest = {
      blogHref: blogPath(site.workspaceSlug),
      posts: posts.map((p) => toBlogCard(p, postPath(site.workspaceSlug, p.slug))),
    };
  }

  const destacados = heroBlogPostIdsFor(blocks);
  if (destacados.length > 0) {
    const posts = await listBlogPostsByIds(blog, destacados).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer los artículos destacados del banner:", err);
      return [];
    });
    data.heroBlogPosts = Object.fromEntries(posts.map((p) => [p.id, toBlogCard(p, postPath(site.workspaceSlug, p.slug))]));
  }

  return data;
}
