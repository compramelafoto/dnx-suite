import { describe, expect, it } from "vitest";
import { createEmptyHeroSlide, type HeroSlide } from "./blocks";
import type { BlogCardItem } from "./dynamic-data";
import {
  blogBannerEndsAt,
  isBlogBannerActive,
  isBlogBannerDuration,
  mergeHeroBlogSlides,
  type HeroBlogSlide,
} from "./blog-banner";

function own(title: string): HeroSlide {
  return { ...createEmptyHeroSlide(), title };
}

function post(id: number): BlogCardItem {
  return {
    id,
    href: `/w/sfpr/blog/articulo-${id}`,
    title: `Artículo ${id}`,
    excerpt: null,
    imageUrl: null,
    categoryName: null,
    dateLabel: null,
    dateIso: null,
  };
}

const at = (position: number, id: number): HeroBlogSlide => ({ position, post: post(id) });
const titles = (slides: { title?: string }[]) => slides.map((s) => s.title);

describe("mergeHeroBlogSlides", () => {
  it("pone el artículo en la placa que pidió", () => {
    const merged = mergeHeroBlogSlides([own("A"), own("B"), own("C")], [at(2, 1)]);
    expect(titles(merged)).toEqual(["A", "Artículo 1", "B", "C"]);
    expect(merged[1].href).toBe("/w/sfpr/blog/articulo-1");
  });

  it("si el banner tiene menos placas, va al final", () => {
    expect(titles(mergeHeroBlogSlides([own("A")], [at(5, 1)]))).toEqual(["A", "Artículo 1"]);
  });

  it("dos artículos en el mismo número quedan en el orden en que llegan", () => {
    expect(titles(mergeHeroBlogSlides([own("A"), own("B")], [at(1, 1), at(1, 2)]))).toEqual(["Artículo 1", "Artículo 2", "A", "B"]);
  });

  it("respeta números distintos aunque lleguen desordenados", () => {
    expect(titles(mergeHeroBlogSlides([own("A"), own("B"), own("C")], [at(3, 2), at(1, 1)]))).toEqual([
      "Artículo 1",
      "A",
      "Artículo 2",
      "B",
      "C",
    ]);
  });

  it("sin artículos, el banner queda como estaba", () => {
    const slides = [own("A")];
    expect(mergeHeroBlogSlides(slides, [])).toEqual(slides);
  });
});

describe("plazo en el banner", () => {
  it("vence a los N días exactos y deja de estar activo", () => {
    const start = new Date("2026-10-05T15:00:00Z");
    const end = blogBannerEndsAt(start, 7);
    expect(end.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(isBlogBannerActive({ startsAt: start, endsAt: end }, new Date("2026-10-12T14:59:59Z"))).toBe(true);
    expect(isBlogBannerActive({ startsAt: start, endsAt: end }, end)).toBe(false);
  });

  it("solo acepta las duraciones ofrecidas", () => {
    expect([7, 15, 30, 60, 90].every(isBlogBannerDuration)).toBe(true);
    expect(isBlogBannerDuration(10)).toBe(false);
  });
});
