import { describe, expect, it } from "vitest";
import {
  addHeroSlide,
  createEmptyBlock,
  createEmptyHeroSlide,
  duplicateHeroSlide,
  getBlockPreviewLabel,
  heroConfigSchema,
  moveHeroSlide,
  parseWebsiteSections,
  removeHeroSlide,
  updateHeroSlide,
  websiteBlockSchema,
  HERO_MAX_SLIDES,
  type HeroBlock,
  type HeroBlockConfig,
  type WebsiteBlock,
} from "./blocks";

describe("parseWebsiteSections — parseo tolerante de sectionsJson", () => {
  it("null o forma inesperada devuelve { pages: { home: [] } }, nunca crashea", () => {
    expect(parseWebsiteSections(null)).toEqual({ pages: { home: [] } });
    expect(parseWebsiteSections("no es un objeto")).toEqual({ pages: { home: [] } });
    expect(parseWebsiteSections({})).toEqual({ pages: { home: [] } });
  });

  it("un bloque inválido dentro del array se descarta, los válidos se conservan (fail-safe)", () => {
    const valid = createEmptyBlock("SPACER", 0);
    const raw = { pages: { home: [valid, { type: "NOPE", garbage: true }, { id: "x" }] } };
    const result = parseWebsiteSections(raw);
    expect(result.pages.home).toHaveLength(1);
    expect(result.pages.home[0].id).toBe(valid.id);
  });

  it("preserva bloques válidos de los 5 tipos implementados", () => {
    const blocks: WebsiteBlock[] = [
      { id: "1", type: "HERO", visible: true, order: 0, config: createEmptyBlock("HERO", 0).config as HeroBlockConfig },
      { id: "2", type: "TEXT", visible: true, order: 1, config: { content: "c", align: "left" } },
      { id: "3", type: "IMAGE", visible: true, order: 2, config: { imageUrl: "u", alt: "a", widthPreset: "full" } },
      { id: "4", type: "CTA", visible: true, order: 3, config: { title: "t", buttonLabel: "b", buttonUrl: "u", stylePreset: "solid" } },
      { id: "5", type: "SPACER", visible: true, order: 4, config: { sizePreset: "md" } },
    ];
    const result = parseWebsiteSections({ pages: { home: blocks } });
    expect(result.pages.home).toHaveLength(5);
  });
});

describe("websiteBlockSchema — unión cerrada de bloques", () => {
  it("rechaza un type desconocido", () => {
    expect(websiteBlockSchema.safeParse({ id: "1", type: "GALLERY", visible: true, order: 0, config: {} }).success).toBe(false);
  });

  it("los campos de texto (title/content/alt/imageUrl) son opcionales a nivel de guardado — un bloque recién agregado y todavía vacío debe poder autoguardarse sin fallar", () => {
    expect(websiteBlockSchema.safeParse(createEmptyBlock("HERO", 0)).success).toBe(true);
    expect(websiteBlockSchema.safeParse({ id: "1", type: "TEXT", visible: true, order: 0, config: { align: "left" } }).success).toBe(true);
    expect(
      websiteBlockSchema.safeParse({ id: "1", type: "IMAGE", visible: true, order: 0, config: { widthPreset: "full" } }).success,
    ).toBe(true);
  });

  it("igual rechaza un `align`/`widthPreset` fuera del enum permitido — no es un campo de texto libre", () => {
    expect(
      websiteBlockSchema.safeParse({ id: "1", type: "TEXT", visible: true, order: 0, config: { align: "diagonal" } }).success,
    ).toBe(false);
  });
});

describe("createEmptyBlock / getBlockPreviewLabel", () => {
  it("createEmptyBlock genera un id único y el order pedido", () => {
    const a = createEmptyBlock("TEXT", 3);
    const b = createEmptyBlock("TEXT", 3);
    expect(a.id).not.toBe(b.id);
    expect(a.order).toBe(3);
    expect(a.type).toBe("TEXT");
  });

  it("getBlockPreviewLabel usa el título/contenido del bloque, nunca JSON crudo", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    expect(getBlockPreviewLabel(hero)).toBe("Sin título todavía");
    const filled: WebsiteBlock = {
      ...hero,
      config: updateHeroSlide(hero.config, hero.config.slides[0].id, { title: "Bienvenidos" }),
    };
    expect(getBlockPreviewLabel(filled)).toBe("Bienvenidos");
  });

  it("getBlockPreviewLabel usa solo el título de la PRIMERA placa, sin sumarle nada más — este label también alimenta el menú de navegación público (`deriveHomeNavItems`), nunca debe llevar texto de administración como \"· N placas\"", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const twoSlides = addHeroSlide(hero.config);
    const withTitle = updateHeroSlide(twoSlides, twoSlides.slides[0].id, { title: "Bienvenidos" });
    const filled: WebsiteBlock = { ...hero, config: withTitle };
    expect(getBlockPreviewLabel(filled)).toBe("Bienvenidos");
  });
});

describe("Hero / Banner — carrusel de placas", () => {
  it("un Hero nuevo (createEmptyBlock) arranca con exactamente 1 placa vacía y defaults seguros", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    expect(hero.config.slides).toHaveLength(1);
    expect(hero.config.autoplay).toBe(true);
    expect(hero.config.intervalMs).toBe(5000);
    expect(hero.config.transition).toBe("fade");
    expect(hero.config.heightPreset).toBe("large");
  });

  it("migración: un Hero guardado en el shape plano anterior (sin `slides`) se interpreta como 1 sola placa, sin perder contenido", () => {
    const legacy = {
      title: "Bienvenidos a SFPR",
      subtitle: "Sociedad de Fotógrafos de Rosario",
      imageUrl: "https://r2.example/fotoffice/website-hero-images/ws1/foto.jpg",
      buttonLabel: "Sumate",
      buttonUrl: "#contacto",
      align: "center",
    };
    const parsed = heroConfigSchema.parse(legacy);
    expect(parsed.slides).toHaveLength(1);
    const slide = parsed.slides[0];
    expect(slide.title).toBe(legacy.title);
    expect(slide.subtitle).toBe(legacy.subtitle);
    expect(slide.imageUrl).toBe(legacy.imageUrl);
    expect(slide.buttonLabel).toBe(legacy.buttonLabel);
    expect(slide.buttonUrl).toBe(legacy.buttonUrl);
    expect(slide.showButton).toBe(true);
    expect(slide.align).toBe("center");
    expect(slide.overlay).toBe("medium");
  });

  it("migración: un Hero viejo sin imagen no hereda overlay (no había nada que oscurecer)", () => {
    const parsed = heroConfigSchema.parse({ title: "Solo texto", align: "left" });
    expect(parsed.slides[0].overlay).toBe("none");
    expect(parsed.slides[0].imageUrl).toBeUndefined();
  });

  it("migración: un Hero viejo sin botón completo no activa showButton", () => {
    const parsed = heroConfigSchema.parse({ title: "T", align: "left", buttonLabel: "Solo label sin url" });
    expect(parsed.slides[0].showButton).toBe(false);
  });

  it("un Hero que YA tiene `slides` no se re-interpreta como legacy", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const withTitle = updateHeroSlide(hero.config, hero.config.slides[0].id, { title: "Placa real" });
    const parsed = heroConfigSchema.parse(withTitle);
    expect(parsed.slides).toHaveLength(1);
    expect(parsed.slides[0].title).toBe("Placa real");
  });

  it("un Hero con 0 slides es inválido (mínimo 1) — nunca queda sin ninguna placa", () => {
    expect(heroConfigSchema.safeParse({ slides: [] }).success).toBe(false);
  });

  it("un Hero con más de 10 slides es inválido (máximo)", () => {
    const slides = Array.from({ length: HERO_MAX_SLIDES + 1 }, () => createEmptyHeroSlide());
    expect(heroConfigSchema.safeParse({ slides }).success).toBe(false);
  });

  it("una placa recién agregada, vacía, es válida (autosave no debe fallar antes de que el usuario escriba algo)", () => {
    expect(heroConfigSchema.safeParse({ slides: [createEmptyHeroSlide()] }).success).toBe(true);
  });

  it("addHeroSlide agrega una placa nueva al final; no agrega más allá del máximo", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const two = addHeroSlide(hero.config);
    expect(two.slides).toHaveLength(2);
    let config = two;
    for (let i = config.slides.length; i < HERO_MAX_SLIDES + 3; i++) config = addHeroSlide(config);
    expect(config.slides).toHaveLength(HERO_MAX_SLIDES);
  });

  it("duplicateHeroSlide clona con id nuevo, la inserta justo después, y no comparte referencia con el original", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const withTitle = updateHeroSlide(hero.config, hero.config.slides[0].id, { title: "Original" });
    const duped = duplicateHeroSlide(withTitle, withTitle.slides[0].id);
    expect(duped.slides).toHaveLength(2);
    expect(duped.slides[1].id).not.toBe(duped.slides[0].id);
    expect(duped.slides[1].title).toBe("Original");
    const changedOriginal = updateHeroSlide(duped, duped.slides[0].id, { title: "Editado" });
    expect(changedOriginal.slides[1].title).toBe("Original");
  });

  it("removeHeroSlide elimina la placa indicada, pero nunca deja el carrusel en 0 placas", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const two = addHeroSlide(hero.config);
    const backToOne = removeHeroSlide(two, two.slides[1].id);
    expect(backToOne.slides).toHaveLength(1);
    const stillOne = removeHeroSlide(backToOne, backToOne.slides[0].id);
    expect(stillOne.slides).toHaveLength(1);
    expect(stillOne).toBe(backToOne);
  });

  it("moveHeroSlide reordena hacia arriba/abajo y es un no-op en los bordes", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const withB = addHeroSlide(hero.config);
    const [slideA, slideB] = withB.slides;
    const moved = moveHeroSlide(withB, slideB.id, "up");
    expect(moved.slides.map((s) => s.id)).toEqual([slideB.id, slideA.id]);
    expect(moveHeroSlide(moved, slideB.id, "up")).toBe(moved);
    expect(moveHeroSlide(moved, slideA.id, "down")).toBe(moved);
  });

  it("updateHeroSlide solo modifica la placa indicada", () => {
    const hero = createEmptyBlock("HERO", 0) as HeroBlock;
    const withB = addHeroSlide(hero.config);
    const updated = updateHeroSlide(withB, withB.slides[1].id, { title: "Segunda" });
    expect(updated.slides[0].title).toBeUndefined();
    expect(updated.slides[1].title).toBe("Segunda");
  });
});
