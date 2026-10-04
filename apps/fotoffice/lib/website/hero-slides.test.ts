import { describe, expect, it } from "vitest";
import {
  addHeroSlide,
  createEmptyBlock,
  createEmptyHeroSlide,
  heroBlogPostIdsFor,
  heroSlideSchema,
  heroSlideTitle,
  type HeroSlide,
  type WebsiteBlock,
} from "./blocks";
import type { BlogCardItem } from "./dynamic-data";
import { resolveHeroSlides } from "./hero-slides";

function blogSlide(blogPostId?: number): HeroSlide {
  return {
    ...createEmptyHeroSlide(),
    source: "blogPost",
    blogPostId,
    blogPreview: blogPostId ? { title: "Copia guardada", excerpt: "Extracto viejo", imageUrl: "https://x/vieja.jpg", href: "/w/sfpr/blog/a" } : undefined,
  };
}

function hero(slides: HeroSlide[], visible = true): WebsiteBlock {
  const block = createEmptyBlock("HERO", 0);
  if (block.type !== "HERO") throw new Error("tipo inesperado");
  return { ...block, visible, config: { ...block.config, slides } };
}

const articulo: BlogCardItem = {
  id: 7,
  href: "/w/sfpr/blog/sorteo",
  title: "Sorteo de octubre",
  excerpt: "Los aliados que participan",
  imageUrl: "https://x/portada.jpg",
  categoryName: null,
  dateLabel: null,
  dateIso: null,
};

describe("placa de artículo del blog", () => {
  it("una placa guardada antes de esto se lee como manual", () => {
    const parsed = heroSlideSchema.parse({ id: "a", imageFocus: "center", showButton: false, buttonStyle: "solid", align: "center", contentPosition: "center", overlay: "none" });
    expect(parsed.source).toBe("manual");
    expect(parsed.blogPostId).toBeUndefined();
  });

  it("agregar una placa de artículo la deja marcada como tal", () => {
    const block = hero([createEmptyHeroSlide()]);
    if (block.type !== "HERO") throw new Error("tipo inesperado");
    const next = addHeroSlide(block.config, "blogPost");
    expect(next.slides.at(-1)?.source).toBe("blogPost");
  });

  it("el título de la placa en listas y menús es el del artículo", () => {
    expect(heroSlideTitle(blogSlide(7))).toBe("Copia guardada");
    expect(heroSlideTitle({ ...createEmptyHeroSlide(), title: "Hola" })).toBe("Hola");
  });

  it("junta los artículos de las placas visibles, sin repetir", () => {
    const ids = heroBlogPostIdsFor([hero([blogSlide(7), blogSlide(7), blogSlide(9), blogSlide()]), hero([blogSlide(11)], false)]);
    expect(ids.sort()).toEqual([7, 9]);
  });
});

describe("resolveHeroSlides", () => {
  it("en el sitio publicado usa el artículo vivo, no la copia guardada", () => {
    const [r] = resolveHeroSlides([blogSlide(7)], { heroBlogPosts: { 7: articulo } });
    expect(r).toMatchObject({ kind: "blogPost", title: "Sorteo de octubre", excerpt: "Los aliados que participan", imageUrl: "https://x/portada.jpg", href: "/w/sfpr/blog/sorteo" });
  });

  it("en el sitio publicado saltea la placa de un artículo que ya no está publicado", () => {
    const manual = createEmptyHeroSlide();
    const r = resolveHeroSlides([blogSlide(99), manual, blogSlide()], { heroBlogPosts: { 7: articulo } });
    expect(r.map((x) => x.slide.id)).toEqual([manual.id]);
  });

  it("en la vista previa del builder usa la copia guardada", () => {
    const [r] = resolveHeroSlides([blogSlide(7)], undefined);
    expect(r).toMatchObject({ kind: "blogPost", title: "Copia guardada", href: "/w/sfpr/blog/a" });
  });

  it("en la vista previa, una placa sin artículo avisa qué falta y no enlaza", () => {
    const [r] = resolveHeroSlides([blogSlide()], undefined);
    expect(r).toMatchObject({ kind: "blogPost", title: "Elegí un artículo del blog", href: null });
  });
});
