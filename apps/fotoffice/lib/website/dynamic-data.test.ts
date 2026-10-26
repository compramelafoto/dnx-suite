import { describe, expect, it } from "vitest";
import { blogLatestConfigSchema, createEmptyBlock, parseWebsiteSections, type WebsiteBlock } from "./blocks";
import { blogLatestLimitFor, datosDeMuestra, paginasDelSitio } from "./dynamic-data";

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

describe("testimonialsLimitFor", () => {
  it("0 sin bloques visibles (no se consulta); el mayor count; null (todos) si alguno pide 0", async () => {
    const { testimonialsLimitFor } = await import("./dynamic-data");
    const con = (count: number, visible = true) => ({ ...createEmptyBlock("TESTIMONIALS", 0), visible, config: { ...createEmptyBlock("TESTIMONIALS", 0).config, count } }) as WebsiteBlock;
    expect(testimonialsLimitFor([createEmptyBlock("TEXT", 0)])).toBe(0);
    expect(testimonialsLimitFor([con(12, false)])).toBe(0);
    expect(testimonialsLimitFor([con(3), con(9)])).toBe(9);
    expect(testimonialsLimitFor([con(3), con(0)])).toBeNull();
  });
});

describe("portfolioBlocksFor", () => {
  it("devuelve sólo los bloques PORTFOLIO visibles: sin ellos no se consulta Trabajos", async () => {
    const { portfolioBlocksFor } = await import("./dynamic-data");
    const visible = createEmptyBlock("PORTFOLIO", 0);
    const oculto = { ...createEmptyBlock("PORTFOLIO", 1), visible: false } as WebsiteBlock;
    expect(portfolioBlocksFor([createEmptyBlock("TEXT", 0)])).toEqual([]);
    expect(portfolioBlocksFor([visible, oculto]).map((b) => b.id)).toEqual([visible.id]);
  });
});

describe("datos de muestra de las plantillas", () => {
  it("6 trabajos por cada bloque Trabajos y 3 testimonios, con las fotos dadas y marcados como muestra", () => {
    const bloques = [createEmptyBlock("PORTFOLIO", 0), createEmptyBlock("PORTFOLIO", 1), createEmptyBlock("TESTIMONIALS", 2)];
    const datos = datosDeMuestra({ bloques, fotos: ["https://images.unsplash.com/a", "https://images.unsplash.com/b"], paginas: {} });
    expect(datos.muestra).toBe(true);
    expect(Object.keys(datos.portfolio!)).toEqual([bloques[0].id, bloques[1].id]);
    expect(datos.portfolio![bloques[0].id].tarjetas).toHaveLength(6);
    expect(datos.portfolio![bloques[0].id].tarjetas.map((t) => t.portadaUrl)).toEqual([
      "https://images.unsplash.com/a",
      "https://images.unsplash.com/b",
      "https://images.unsplash.com/a",
      "https://images.unsplash.com/b",
      "https://images.unsplash.com/a",
      "https://images.unsplash.com/b",
    ]);
    expect(datos.testimonios!.items).toHaveLength(3);
    // Nada de la muestra lleva a ningún lado ni trae el correo de nadie.
    expect(JSON.stringify(datos)).not.toMatch(/@/);
  });

  it("las páginas del sitio quedan por dirección bajo la base", () => {
    expect(paginasDelSitio("/w/dnx", { quien_soy: { slug: "quien-soy" }, p_1: { slug: "agenda" } })).toEqual({
      "quien-soy": "/w/dnx/quien-soy",
      agenda: "/w/dnx/agenda",
    });
  });
});
