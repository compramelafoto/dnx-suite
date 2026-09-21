import { describe, expect, it } from "vitest";
import { createEmptyBlock } from "./blocks";
import { pickPublishedHomeBlocks } from "./public-site";

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
