import type { PortfolioBlock, WebsiteBlock } from "./blocks";
import type { TrabajoTarjeta } from "@/lib/trabajos/publico";
import type { SpotlightCardView } from "@/lib/spotlight/view";
import type { HeroBlogSlide } from "./blog-banner";
import type { PublicSiteContact } from "./public-site";

/**
 * Datos que los bloques `dynamic` necesitan y que NO viven en `sectionsJson`: se leen en el
 * servidor al dibujar la página pública y bajan al renderer como una prop más.
 *
 * Es un objeto plano y serializable a propósito: el mismo `WebsitePageRenderer` se usa en la
 * vista previa del builder, que es un componente de cliente sin acceso a la base. Ahí no llega
 * nada (`undefined`) y cada bloque dinámico muestra un ejemplo en su lugar — así el dueño ve
 * cómo va a quedar sin que el builder tenga que consultar otro módulo.
 *
 * Privacidad: lo que entra acá termina en el HTML de cualquiera. Sólo campos ya públicos, con
 * forma propia (nunca el modelo de Prisma entero).
 */
export type BlogCardItem = {
  id: number;
  href: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  /** Ya formateada en hora argentina en el servidor: el navegador no tiene que adivinar la zona. */
  dateLabel: string | null;
  dateIso: string | null;
};

export type BlogLatestData = {
  blogHref: string;
  posts: BlogCardItem[];
};

/** El socio de esta semana, ya filtrado por permiso de publicación (ver `buildSpotlightCard`). */
export type MemberOfWeekData = {
  card: SpotlightCardView | null;
  weekLabel: string;
};

/** Artículos destacados desde el blog, para el banner principal (`blockId`). Ver `blog-banner.ts`. */
export type HeroBlogData = {
  blockId: string;
  slides: HeroBlogSlide[];
};

export type WebsiteDynamicData = {
  blogLatest?: BlogLatestData;
  memberOfWeek?: MemberOfWeekData;
  heroBlog?: HeroBlogData;
  /** Contacto de la institución (el mismo del pie del sitio), para completar los campos vacíos
   * del bloque CONTACT. Ya es público; sólo viaja si la página tiene el bloque. */
  contact?: PublicSiteContact;
  /** Categorías y orígenes activos para el formulario de presupuesto (INQUIRY_FORM). Sólo viaja
   * si la página tiene el bloque y Consultas está encendido; sin esto el bloque no se dibuja. */
  inquiry?: InquiryFormData;
  /** Las tarjetas de cada bloque PORTFOLIO, por id de bloque: dos bloques pueden pedir
   * categorías o cantidades distintas. Un bloque sin entrada (o sin tarjetas) no se dibuja. */
  portfolio?: Record<string, PortfolioData>;
};

/** Lo que dibuja un bloque PORTFOLIO: sólo trabajos PUBLICADOS de categorías visibles. */
export type PortfolioData = {
  tarjetas: TrabajoTarjeta[];
  /** `/w/<slug>/trabajos`, o la página de la categoría si el bloque pide una. */
  verTodosHref: string;
};

export type InquiryFormData = {
  /** A qué workspace va la consulta (el formulario lo manda a `createSiteInquiry`). */
  workspaceSlug: string;
  categorias: Array<{ id: string; nombre: string }>;
  origenes: Array<{ id: string; nombre: string }>;
  /** Categoría preelegida (`/presupuesto?categoria=<id>`); se ignora si no está en la lista. */
  categoriaPreelegida?: string;
};

export function hasVisibleInquiryForm(blocks: readonly WebsiteBlock[]): boolean {
  return blocks.some((b) => b.type === "INQUIRY_FORM" && b.visible);
}

export function hasVisibleContact(blocks: readonly WebsiteBlock[]): boolean {
  return blocks.some((b) => b.type === "CONTACT" && b.visible);
}

export function hasVisibleMemberOfWeek(blocks: readonly WebsiteBlock[]): boolean {
  return blocks.some((b) => b.type === "MEMBER_OF_WEEK" && b.visible);
}

/**
 * Cuántos artículos hay que leer para los bloques "Últimos artículos" de la página: el mayor
 * `count` entre los visibles, o 0 si no hay ninguno — en ese caso no se consulta el blog.
 * Una sola consulta alcanza para todos: cada bloque recorta los primeros N.
 */
export function blogLatestLimitFor(blocks: readonly WebsiteBlock[]): number {
  let limit = 0;
  for (const block of blocks) {
    if (block.type === "BLOG_LATEST" && block.visible) limit = Math.max(limit, block.config.count);
  }
  return limit;
}

/** Los bloques "Trabajos" visibles de la página. Sin ninguno, Trabajos ni se consulta. */
export function portfolioBlocksFor(blocks: readonly WebsiteBlock[]): PortfolioBlock[] {
  return blocks.filter((b): b is PortfolioBlock => b.type === "PORTFOLIO" && b.visible);
}
