import { describe, expect, it } from "vitest";
import { createEmptyBlock, emptyWebsiteSections, type WebsiteSections } from "./blocks";
import { mergePageSave } from "./save-pages";

const textoA = createEmptyBlock("TEXT", 0);
const textoB = createEmptyBlock("TEXT", 1);

function conUnaPagina(): WebsiteSections {
  return {
    pages: { home: [textoA], p1: [textoB] },
    pageMeta: { p1: { slug: "quien-soy", title: "Quién soy" } },
  };
}

describe("mergePageSave", () => {
  it("guardar los bloques de home no toca las otras páginas ni la meta", () => {
    const r = mergePageSave(conUnaPagina(), { pageKey: "home", blocks: [] });
    if ("error" in r) throw new Error(r.error);
    expect(r.sections.pages.home).toEqual([]);
    expect(r.sections.pages.p1).toEqual([textoB]);
    expect(r.sections.pageMeta.p1.slug).toBe("quien-soy");
  });

  it("guardar bloques de una clave sin meta es un error", () => {
    const r = mergePageSave(emptyWebsiteSections(), { pageKey: "fantasma", blocks: [textoA] });
    expect("error" in r).toBe(true);
  });

  it("crear una página y sus bloques en el mismo guardado funciona", () => {
    const r = mergePageSave(emptyWebsiteSections(), {
      pageKey: "p9",
      blocks: [textoA],
      pageMeta: { p9: { slug: "contacto", title: "Contacto" } },
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.sections.pages.p9).toEqual([textoA]);
  });

  it("dos páginas con el mismo slug es un error", () => {
    const r = mergePageSave(emptyWebsiteSections(), {
      pageKey: "home",
      pageMeta: { a: { slug: "igual", title: "A" }, b: { slug: "igual", title: "B" } },
    });
    expect("error" in r).toBe(true);
  });

  it("un slug reservado es un error", () => {
    const r = mergePageSave(emptyWebsiteSections(), {
      pageKey: "home",
      pageMeta: { a: { slug: "blog", title: "A" } },
    });
    expect("error" in r).toBe(true);
  });

  it("la unicidad se exige aunque el guardado no mande meta (estado heredado roto)", () => {
    const roto: WebsiteSections = {
      pages: { home: [], a: [], b: [] },
      pageMeta: { a: { slug: "igual", title: "A" }, b: { slug: "igual", title: "B" } },
    };
    const r = mergePageSave(roto, { pageKey: "home", blocks: [] });
    expect("error" in r).toBe(true);
  });

  it("quitar una clave de la meta borra también sus bloques", () => {
    const r = mergePageSave(conUnaPagina(), { pageKey: "home", pageMeta: {} });
    if ("error" in r) throw new Error(r.error);
    expect(r.sections.pages.p1).toBeUndefined();
    expect(r.sections.pageMeta).toEqual({});
    expect(r.sections.pages.home).toEqual([textoA]);
  });

  it("home no se puede borrar ni tener meta", () => {
    const r = mergePageSave(conUnaPagina(), {
      pageKey: "home",
      pageMeta: { home: { slug: "inicio", title: "Inicio" } },
    });
    expect("error" in r).toBe(true);
    const sinHome = mergePageSave(conUnaPagina(), { pageKey: "home", pageMeta: {} });
    if ("error" in sinHome) throw new Error(sinHome.error);
    expect(sinHome.sections.pages.home).toEqual([textoA]);
  });

  it("tope de 50 páginas propias", () => {
    const meta: Record<string, { slug: string; title: string }> = {};
    for (let i = 0; i < 51; i++) meta[`p${i}`] = { slug: `pagina-${i}`, title: `P ${i}` };
    expect("error" in mergePageSave(emptyWebsiteSections(), { pageKey: "home", pageMeta: meta })).toBe(true);
    delete meta.p50;
    expect("error" in mergePageSave(emptyWebsiteSections(), { pageKey: "home", pageMeta: meta })).toBe(false);
  });
});
