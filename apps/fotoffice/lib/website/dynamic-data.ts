import type { WebsiteBlock } from "./blocks";
import type { SpotlightCardView } from "@/lib/spotlight/view";

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

export type WebsiteDynamicData = {
  blogLatest?: BlogLatestData;
  memberOfWeek?: MemberOfWeekData;
};

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
