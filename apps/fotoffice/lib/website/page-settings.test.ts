import { describe, expect, it } from "vitest";
import { parseWebsiteSections } from "./blocks";
import { applyPageSettings, pageSettingsInputSchema } from "./page-settings";
import { mergePageSave } from "./save-pages";

const raw = {
  pages: { home: [], p_1: [], p_2: [] },
  pageMeta: {
    p_1: { slug: "quien-soy", title: "Quién soy" },
    p_2: { slug: "talleres", title: "Cursos", shareImageUrl: "https://cdn.test/curso.jpg", hideFromSearch: true },
  },
};

describe("ajustes por página en pageMeta", () => {
  it("una meta vieja (sin ajustes) sigue valiendo; una con valores rotos no tira la página", () => {
    const s = parseWebsiteSections({
      ...raw,
      pageMeta: { ...raw.pageMeta, p_1: { slug: "quien-soy", title: "Quién soy", shareImageUrl: "javascript:x", hideFromSearch: "sí" } },
    });
    expect(Object.keys(s.pageMeta)).toEqual(["p_1", "p_2"]);
    expect(s.pageMeta.p_1.shareImageUrl).toBeUndefined();
    expect(s.pageMeta.p_1.hideFromSearch).toBeUndefined();
    expect(s.pageMeta.p_2).toMatchObject({ shareImageUrl: "https://cdn.test/curso.jpg", hideFromSearch: true });
  });

  it("applyPageSettings pone y saca valores sólo en páginas que existen, y el guardado los conserva", () => {
    const s = parseWebsiteSections(raw);
    const nuevo = applyPageSettings(s, {
      p_1: { shareImageUrl: "https://cdn.test/yo.jpg", hideFromSearch: true },
      p_2: { shareImageUrl: null, hideFromSearch: false },
      p_9: { shareImageUrl: null, hideFromSearch: true },
    });
    expect(nuevo.pageMeta.p_1).toEqual({ slug: "quien-soy", title: "Quién soy", shareImageUrl: "https://cdn.test/yo.jpg", hideFromSearch: true });
    expect(nuevo.pageMeta.p_2).toEqual({ slug: "talleres", title: "Cursos" });
    expect(nuevo.pageMeta).not.toHaveProperty("p_9");

    const merged = mergePageSave(nuevo, { pageKey: "home" });
    expect("sections" in merged && merged.sections.pageMeta.p_1.hideFromSearch).toBe(true);
  });

  it("el schema de entrada rechaza imágenes que no son https", () => {
    expect(pageSettingsInputSchema.safeParse({ p_1: { shareImageUrl: "http://a.test/x.jpg", hideFromSearch: false } }).success).toBe(false);
    expect(pageSettingsInputSchema.safeParse({ p_1: { shareImageUrl: "", hideFromSearch: false } }).success).toBe(true);
  });
});
