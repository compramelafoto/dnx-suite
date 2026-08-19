import { describe, expect, it } from "vitest";
import {
  createEmptyBlock,
  getBlockPreviewLabel,
  parseWebsiteSections,
  websiteBlockSchema,
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
      { id: "1", type: "HERO", visible: true, order: 0, config: { title: "T", align: "center" } },
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

  it("HERO exige title, TEXT exige content, IMAGE exige imageUrl y alt", () => {
    expect(websiteBlockSchema.safeParse({ id: "1", type: "HERO", visible: true, order: 0, config: { align: "left" } }).success).toBe(false);
    expect(websiteBlockSchema.safeParse({ id: "1", type: "TEXT", visible: true, order: 0, config: { align: "left" } }).success).toBe(false);
    expect(
      websiteBlockSchema.safeParse({ id: "1", type: "IMAGE", visible: true, order: 0, config: { widthPreset: "full" } }).success,
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
    const hero = createEmptyBlock("HERO", 0);
    expect(getBlockPreviewLabel(hero)).toBe("Sin título todavía");
    const filled: WebsiteBlock = { ...hero, config: { ...hero.config, title: "Bienvenidos" } };
    expect(getBlockPreviewLabel(filled)).toBe("Bienvenidos");
  });
});
