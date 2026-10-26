import { describe, expect, it } from "vitest";
import { createEmptyBlock } from "./blocks";
import { pickPublishedHomeBlocks, resolvePublicCustomPage } from "./public-site";

const seccionesPublicadas = { pages: { home: [createEmptyBlock("TEXT", 0)] } };

describe("pickPublishedHomeBlocks", () => {
  it("módulo habilitado y versión publicada: se muestran sus secciones", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: seccionesPublicadas,
    });
    expect(r.hasPublishedSite).toBe(true);
    expect(r.homeBlocks).toHaveLength(1);
  });

  it("módulo habilitado y sin publicar nunca: no hay sitio", () => {
    const r = pickPublishedHomeBlocks({ websiteModuleEnabled: true, publishedSectionsJson: null });
    expect(r.hasPublishedSite).toBe(false);
    expect(r.homeBlocks).toEqual([]);
  });

  it("módulo NO habilitado: no hay sitio aunque exista una versión publicada", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: false,
      publishedSectionsJson: seccionesPublicadas,
    });
    expect(r.hasPublishedSite).toBe(false);
    expect(r.homeBlocks).toEqual([]);
  });

  it("módulo habilitado con una versión publicada vacía: hay sitio, sin secciones", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: { pages: { home: [] } },
    });
    expect(r.hasPublishedSite).toBe(true);
    expect(r.homeBlocks).toEqual([]);
  });

  it("un sectionsJson corrupto no rompe: hay sitio y se muestra vacío", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: "esto no es un sitio",
    });
    expect(r.hasPublishedSite).toBe(true);
    expect(r.homeBlocks).toEqual([]);
  });

  it("una sección inválida se descarta y las válidas se conservan", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: {
        pages: { home: [{ type: "NO_EXISTE", id: "x" }, createEmptyBlock("TEXT", 1)] },
      },
    });
    expect(r.homeBlocks).toHaveLength(1);
    expect(r.homeBlocks[0].type).toBe("TEXT");
  });
});

describe("resolvePublicCustomPage", () => {
  const publicado = {
    pages: { home: [], p1: [createEmptyBlock("TEXT", 0)] },
    pageMeta: { p1: { slug: "quien-soy", title: "Quién soy", seoDescription: "Mi historia" } },
  };
  function sitio(publishedSectionsJson: unknown, websiteModuleEnabled = true) {
    const { sections, hasPublishedSite } = pickPublishedHomeBlocks({ websiteModuleEnabled, publishedSectionsJson });
    return { sections, hasPublishedSite };
  }

  it("un segmento que coincide con el slug de una página publicada la encuentra", () => {
    const r = resolvePublicCustomPage(sitio(publicado), ["quien-soy"]);
    expect(r?.meta.title).toBe("Quién soy");
    expect(r?.blocks).toHaveLength(1);
  });

  it("más de un segmento no es una página propia", () => {
    expect(resolvePublicCustomPage(sitio(publicado), ["quien-soy", "x"])).toBeNull();
  });

  it("sin segmentos no hay página", () => {
    expect(resolvePublicCustomPage(sitio(publicado), [])).toBeNull();
  });

  it("sitio sin publicar: nada", () => {
    expect(resolvePublicCustomPage(sitio(null), ["quien-soy"])).toBeNull();
    expect(resolvePublicCustomPage(sitio(publicado, false), ["quien-soy"])).toBeNull();
  });

  it("un slug que sólo existe en el borrador (no en lo publicado) no se sirve", () => {
    const sinLaPagina = { pages: { home: [] }, pageMeta: {} };
    expect(resolvePublicCustomPage(sitio(sinLaPagina), ["quien-soy"])).toBeNull();
  });
});
