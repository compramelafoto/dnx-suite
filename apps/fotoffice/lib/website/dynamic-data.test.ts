import { describe, expect, it } from "vitest";
import { blogLatestConfigSchema, createEmptyBlock, parseWebsiteSections, type WebsiteBlock } from "./blocks";
import { blogLatestLimitFor } from "./dynamic-data";

function blogLatest(count: 3 | 6, visible = true): WebsiteBlock {
  const block = createEmptyBlock("BLOG_LATEST", 0);
  if (block.type !== "BLOG_LATEST") throw new Error("tipo inesperado");
  return { ...block, visible, config: { ...block.config, count } };
}

describe("blogLatestLimitFor", () => {
  it("sin bloques de artículos no se consulta el blog", () => {
    expect(blogLatestLimitFor([createEmptyBlock("TEXT", 0)])).toBe(0);
  });

  it("con varios bloques, lee la cantidad del más grande", () => {
    expect(blogLatestLimitFor([blogLatest(3), blogLatest(6)])).toBe(6);
  });

  it("un bloque oculto no cuenta", () => {
    expect(blogLatestLimitFor([blogLatest(6, false), blogLatest(3)])).toBe(3);
  });
});

describe("bloque BLOG_LATEST", () => {
  it("nace con título, 3 artículos y extracto", () => {
    const block = createEmptyBlock("BLOG_LATEST", 0);
    expect(block.config).toEqual({ title: "Últimos artículos", count: 3, showExcerpt: true });
  });

  it("una cantidad fuera de lo permitido cae a 3 en vez de descartar el bloque", () => {
    expect(blogLatestConfigSchema.parse({ count: 12, showExcerpt: "sí" })).toEqual({ count: 3, showExcerpt: true });
  });

  it("sobrevive a la lectura tolerante de sectionsJson", () => {
    const sections = parseWebsiteSections({ pages: { home: [blogLatest(6)] } });
    expect(sections.pages.home).toHaveLength(1);
    expect(sections.pages.home[0].type).toBe("BLOG_LATEST");
  });
});
