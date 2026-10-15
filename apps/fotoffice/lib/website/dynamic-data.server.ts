import "server-only";
import { prisma } from "@repo/db";
import { blogPath, listBlogPosts, listBlogPostsByIds, postPath } from "@/lib/blog/public";
import { toBlogCard } from "@/lib/blog/public-format";
import type { PublicSite } from "./public-site";
import { blogLatestLimitFor, hasVisibleMemberOfWeek, type WebsiteDynamicData } from "./dynamic-data";
import { loadPublicMemberOfWeek } from "@/lib/spotlight/public";
import { mainHeroBlockId, type HeroBlogSlide } from "./blog-banner";

/**
 * Lee lo que piden los bloques dinámicos de una página publicada, y nada más: si la página no
 * tiene "Últimos artículos", el blog ni se consulta. Corre en el servidor del sitio público;
 * el builder no la llama (ver `dynamic-data.ts`).
 *
 * Si una lectura falla, ese bloque recibe una lista vacía y no se dibuja: un problema del blog
 * no puede tirar la portada entera de la institución.
 */
export async function loadWebsiteDynamicData(site: PublicSite, blocks: PublicSite["homeBlocks"]): Promise<WebsiteDynamicData> {
  const data: WebsiteDynamicData = {};

  const blogLimit = blogLatestLimitFor(blocks);
  if (blogLimit > 0) {
    const blog = { workspaceId: site.workspaceId, slug: site.workspaceSlug, nombre: site.commercialName, logoUrl: site.logoUrl };
    const posts = await listBlogPosts(blog, { limit: blogLimit }).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer los últimos artículos:", err);
      return [];
    });
    data.blogLatest = {
      blogHref: blogPath(site.workspaceSlug),
      posts: posts.map((p) => toBlogCard(p, postPath(site.workspaceSlug, p.slug))),
    };
  }

  if (hasVisibleMemberOfWeek(blocks)) {
    data.memberOfWeek = await loadPublicMemberOfWeek({
      workspaceId: site.workspaceId,
      institution: site.commercialName,
    }).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudo leer el socio de la semana:", err);
      return { card: null, weekLabel: "" };
    });
  }

  const heroBlockId = mainHeroBlockId(blocks);
  if (heroBlockId) {
    const slides = await loadHeroBlogSlides(site).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer los artículos del banner:", err);
      return [];
    });
    if (slides.length > 0) data.heroBlog = { blockId: heroBlockId, slides };
  }

  return data;
}

/**
 * Los artículos que hoy ocupan una placa del banner: plazo vigente y artículo todavía
 * publicado (uno despublicado o borrado no vuelve de `listBlogPostsByIds`).
 */
async function loadHeroBlogSlides(site: PublicSite): Promise<HeroBlogSlide[]> {
  const now = new Date();
  const slots = await prisma.fotofficeBlogBannerSlot.findMany({
    where: { workspaceId: site.workspaceId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { postId: true, position: true },
  });
  if (slots.length === 0) return [];
  const blog = { workspaceId: site.workspaceId, slug: site.workspaceSlug, nombre: site.commercialName, logoUrl: site.logoUrl };
  const posts = await listBlogPostsByIds(blog, slots.map((s) => s.postId));
  const byId = new Map(posts.map((p) => [p.id, p]));
  return slots.flatMap((slot) => {
    const post = byId.get(slot.postId);
    return post ? [{ position: slot.position, post: toBlogCard(post, postPath(site.workspaceSlug, post.slug)) }] : [];
  });
}
