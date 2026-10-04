import type { HeroSlide } from "./blocks";
import type { WebsiteDynamicData } from "./dynamic-data";

/**
 * Lo que efectivamente se dibuja de una placa del banner.
 *
 * Una placa `manual` pasa tal cual. Una que destaca un artículo del blog toma portada, título y
 * extracto del artículo, y la placa entera enlaza a él.
 */
export type ResolvedHeroSlide =
  | { kind: "manual"; slide: HeroSlide }
  | {
      kind: "blogPost";
      slide: HeroSlide;
      title: string;
      excerpt: string | null;
      imageUrl: string | null;
      /** `null` en la vista previa mientras no se eligió ningún artículo. */
      href: string | null;
    };

/**
 * Resuelve las placas contra lo que leyó el servidor.
 *
 * - En el sitio publicado (`data.heroBlogPosts` presente) se usa el artículo vivo. Si ya no está
 *   publicado —o la placa nunca eligió uno— la placa se saltea: un enlace a un artículo borrado
 *   sería una placa rota en la portada.
 * - En la vista previa del builder (`heroBlogPosts` ausente: no hay base en el cliente) se usa la
 *   copia guardada al elegir el artículo, y una placa todavía sin artículo muestra un aviso para
 *   que quien edita sepa qué falta.
 */
export function resolveHeroSlides(slides: readonly HeroSlide[], data: WebsiteDynamicData | undefined): ResolvedHeroSlide[] {
  const live = data?.heroBlogPosts;
  const out: ResolvedHeroSlide[] = [];
  for (const slide of slides) {
    if (slide.source !== "blogPost") {
      out.push({ kind: "manual", slide });
      continue;
    }
    if (live) {
      const post = slide.blogPostId ? live[slide.blogPostId] : undefined;
      if (!post) continue;
      out.push({ kind: "blogPost", slide, title: post.title, excerpt: post.excerpt, imageUrl: post.imageUrl, href: post.href });
      continue;
    }
    const preview = slide.blogPostId ? slide.blogPreview : undefined;
    out.push(
      preview
        ? { kind: "blogPost", slide, title: preview.title, excerpt: preview.excerpt, imageUrl: preview.imageUrl, href: preview.href }
        : { kind: "blogPost", slide, title: "Elegí un artículo del blog", excerpt: null, imageUrl: null, href: null },
    );
  }
  return out;
}
