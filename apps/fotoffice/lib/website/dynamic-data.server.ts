import "server-only";
import { prisma } from "@repo/db";
import { blogPath, listBlogPosts, listBlogPostsByIds, postPath } from "@/lib/blog/public";
import { toBlogCard } from "@/lib/blog/public-format";
import type { PublicSite } from "./public-site";
import {
  blogLatestLimitFor,
  hasVisibleContact,
  hasVisibleInquiryForm,
  hasVisibleMemberOfWeek,
  portfolioBlocksFor,
  testimonialsLimitFor,
  type PortfolioData,
  type WebsiteDynamicData,
} from "./dynamic-data";
import { listarTrabajosPublicos } from "@/lib/trabajos/publico";
import { listarTestimoniosPublicos } from "@/lib/testimonios/publico";
import { TESTIMONIO_FORM_SEGMENT, TESTIMONIOS_PUBLIC_SEGMENT, TRABAJOS_PUBLIC_SEGMENT } from "./constants";
import { opcionesDelFormulario } from "./inquiry";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
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

  // El contacto ya viene en `site` (lo lee el layout para el pie): no hay otra consulta.
  if (hasVisibleContact(blocks)) data.contact = site.contact;

  // El formulario de presupuesto da de alta en Consultas: con el módulo apagado no se dibuja.
  // Si la lectura falla, tampoco (mejor sin formulario que uno sin categorías).
  if (hasVisibleInquiryForm(blocks) && site.enabledModuleKeys.has(SERVICE_LEADS_MODULE_KEY)) {
    const opciones = await opcionesDelFormulario(site.workspaceId).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer las categorías del formulario:", err);
      return null;
    });
    if (opciones) data.inquiry = { workspaceSlug: site.workspaceSlug, ...opciones };
  }

  const portfolios = portfolioBlocksFor(blocks);
  if (portfolios.length > 0) {
    const base = `/w/${site.workspaceSlug}`;
    const entradas = await Promise.all(
      portfolios.map(async (block): Promise<[string, PortfolioData]> => {
        const { trabajos } = await listarTrabajosPublicos(site.workspaceId, {
          categoriaId: block.config.categoriaId,
          limite: block.config.count,
          base,
          sinTotal: true,
        }).catch((err: unknown) => {
          console.error("[fotoffice][website] no se pudieron leer los trabajos:", err);
          return { trabajos: [], total: 0 };
        });
        // Con categoría, «Ver todos» lleva a esa categoría (la saca de las tarjetas: si no hay
        // ninguna, el bloque no se dibuja y el enlace no importa).
        const categoriaSlug = block.config.categoriaId ? trabajos[0]?.categoriaSlug : undefined;
        const verTodosHref = `${base}/${TRABAJOS_PUBLIC_SEGMENT}${categoriaSlug ? `/${categoriaSlug}` : ""}`;
        return [block.id, { tarjetas: trabajos, verTodosHref }];
      }),
    );
    data.portfolio = Object.fromEntries(entradas);
  }

  // Una sola lectura para todos los bloques de Testimonios; se mezclan los no destacados para que la
  // portada no muestre siempre los mismos. Si falla, el bloque no se dibuja.
  const testimonialsLimit = testimonialsLimitFor(blocks);
  if (testimonialsLimit !== 0) {
    const base = `/w/${site.workspaceSlug}`;
    // Uno más que el mayor pedido: así cada bloque sabe si hay más para «Ver todos».
    const limite = testimonialsLimit === null ? 0 : testimonialsLimit + 1;
    const items = await listarTestimoniosPublicos(site.workspaceId, { limite, barajar: true }).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer los testimonios:", err);
      return [];
    });
    data.testimonios = {
      items,
      verTodosHref: `${base}/${TESTIMONIOS_PUBLIC_SEGMENT}`,
      formularioHref: `${base}/${TESTIMONIO_FORM_SEGMENT}`,
    };
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
