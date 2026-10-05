import type { HeroSlide, WebsiteBlock } from "./blocks";
import type { BlogCardItem } from "./dynamic-data";

/**
 * Artículos del blog destacados en el banner principal del sitio. PURO.
 *
 * Se eligen desde el editor del artículo ("en la placa 2, por 15 días") y se guardan en
 * `FotofficeBlogBannerSlot`, no en el sitio: así el sitio publicado los muestra en vivo, sin
 * republicar, y al vencer el plazo dejan de verse solos.
 */

export const BLOG_BANNER_DURATIONS = [7, 15, 30, 60, 90] as const;
export type BlogBannerDuration = (typeof BLOG_BANNER_DURATIONS)[number];

/** Hasta qué placa se puede pedir. Coincide con el máximo de placas propias del banner. */
export const BLOG_BANNER_MAX_POSITION = 10;

const DIA_MS = 24 * 60 * 60 * 1000;

export function isBlogBannerDuration(value: number): value is BlogBannerDuration {
  return (BLOG_BANNER_DURATIONS as readonly number[]).includes(value);
}

export function blogBannerEndsAt(startsAt: Date, durationDays: number): Date {
  return new Date(startsAt.getTime() + durationDays * DIA_MS);
}

export function isBlogBannerActive(slot: { startsAt: Date; endsAt: Date }, now: Date): boolean {
  return slot.startsAt.getTime() <= now.getTime() && now.getTime() < slot.endsAt.getTime();
}

/** Un artículo ya leído (publicado) y la placa que pidió. */
export type HeroBlogSlide = { position: number; post: BlogCardItem };

/** Una placa lista para dibujar. `href`: la placa entera lleva ahí (las del blog). */
export type HeroRenderSlide = HeroSlide & { href?: string };

/** El banner al que van los artículos: el primer Hero visible de la página. */
export function mainHeroBlockId(blocks: readonly WebsiteBlock[]): string | null {
  return blocks.find((b) => b.type === "HERO" && b.visible)?.id ?? null;
}

/** La placa de un artículo: su portada de fondo, título y bajada abajo a la izquierda. */
export function blogPostToHeroSlide(post: BlogCardItem): HeroRenderSlide {
  return {
    id: `blog-${post.id}`,
    imageUrl: post.imageUrl ?? undefined,
    imageAlt: post.title,
    imageFocus: "center",
    title: post.title,
    subtitle: post.excerpt ?? undefined,
    showButton: true,
    buttonLabel: "Leer el artículo",
    buttonUrl: post.href,
    buttonStyle: "solid",
    align: "left",
    contentPosition: "bottom",
    overlay: "medium",
    href: post.href,
  };
}

/**
 * Mete las placas del blog entre las propias, cada una en el número que pidió. Si el banner
 * tiene menos placas, va al final. Dos artículos en el mismo número quedan uno detrás del otro,
 * en el orden en que llegan (el loader los pasa por fecha de alta).
 */
export function mergeHeroBlogSlides(own: readonly HeroSlide[], blog: readonly HeroBlogSlide[]): HeroRenderSlide[] {
  const result: HeroRenderSlide[] = [...own];
  const ordered = blog
    .map((b, i) => ({ ...b, i }))
    .sort((a, b) => a.position - b.position || a.i - b.i);
  let lastIndex = -1;
  for (const item of ordered) {
    let index = Math.min(Math.max(item.position, 1) - 1, result.length);
    if (index <= lastIndex) index = lastIndex + 1;
    result.splice(index, 0, blogPostToHeroSlide(item.post));
    lastIndex = index;
  }
  return result;
}
