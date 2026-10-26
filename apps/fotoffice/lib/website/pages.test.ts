import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseWebsiteSections, emptyWebsiteSections } from "./blocks";
import {
  HOME_PAGE_KEY,
  findPageBySlug,
  listCustomPages,
  nextPageKey,
  slugifyPageTitle,
  validatePageSlug,
} from "./pages";
import { RESERVED_SITE_SEGMENTS } from "./reserved-slugs";
import { FOTOFFICE_ONLY_SEGMENTS } from "./domain/routing";
import { SITE_RESERVED_SEGMENTS } from "./public-modules";
import sfprSections from "./__fixtures__/sfpr-sections.json";

const textBlock = (id: string) => ({ id, type: "TEXT", visible: true, order: 0, config: { content: "hola", align: "left" } });

describe("parseWebsiteSections con pageMeta", () => {
  it("un JSON viejo (sólo home) devuelve pageMeta vacío", () => {
    const s = parseWebsiteSections({ pages: { home: [textBlock("a")] } });
    expect(s.pageMeta).toEqual({});
    expect(s.pages.home.map((b) => b.id)).toEqual(["a"]);
  });

  it("emptyWebsiteSections trae home vacío y pageMeta vacío", () => {
    expect(emptyWebsiteSections()).toEqual({ pages: { home: [] }, pageMeta: {} });
  });

  it("el JSON real de SFPR conserva los mismos ids de bloques", () => {
    const s = parseWebsiteSections(sfprSections);
    const idsCrudos = (sfprSections as { pages: { home: { id: string }[] } }).pages.home.map((b) => b.id);
    expect(s.pages.home.map((b) => b.id)).toEqual(idsCrudos);
    expect(s.pageMeta).toEqual({});
  });

  it("descarta pageMeta sin pages[clave] y pages[clave] sin meta (salvo home)", () => {
    const s = parseWebsiteSections({
      pages: { home: [], huerfana: [textBlock("x")], ok: [textBlock("y")] },
      pageMeta: {
        ok: { slug: "ok", title: "Ok" },
        fantasma: { slug: "fantasma", title: "Fantasma" },
      },
    });
    expect(Object.keys(s.pages).sort()).toEqual(["home", "ok"]);
    expect(Object.keys(s.pageMeta)).toEqual(["ok"]);
  });

  it("descarta una meta inválida y la página con ella; nunca acepta meta de home", () => {
    const s = parseWebsiteSections({
      pages: { home: [], mala: [] },
      pageMeta: { mala: { slug: "Mala Slug", title: "" }, home: { slug: "home", title: "Home" } },
    });
    expect(s.pageMeta).toEqual({});
    expect(Object.keys(s.pages)).toEqual(["home"]);
  });
});

describe("listCustomPages / findPageBySlug", () => {
  const s = parseWebsiteSections({
    pages: { home: [], p1: [textBlock("a")], p2: [] },
    pageMeta: { p1: { slug: "quien-soy", title: "Quién soy" }, p2: { slug: "contacto", title: "Contacto" } },
  });

  it("lista en orden de inserción", () => {
    expect(listCustomPages(s).map((p) => p.key)).toEqual(["p1", "p2"]);
  });

  it("encuentra por slug o devuelve null", () => {
    const found = findPageBySlug(s, "quien-soy");
    expect(found?.key).toBe("p1");
    expect(found?.meta.title).toBe("Quién soy");
    expect(found?.blocks.map((b) => b.id)).toEqual(["a"]);
    expect(findPageBySlug(s, "nada")).toBeNull();
    expect(HOME_PAGE_KEY).toBe("home");
  });
});

describe("validatePageSlug", () => {
  it("rechaza reservados", () => {
    expect(validatePageSlug("blog", [])).toBe("Esa dirección ya la usa el sitio");
  });
  it("rechaza repetidos", () => {
    expect(validatePageSlug("quien-soy", ["quien-soy"])).toBe("Ya hay otra página con esa dirección");
  });
  it("rechaza mal formato", () => {
    expect(validatePageSlug("Quién Soy", [])).not.toBeNull();
    expect(validatePageSlug("", [])).not.toBeNull();
  });
  it("acepta uno válido", () => {
    expect(validatePageSlug("quien-soy", [])).toBeNull();
  });
});

describe("slugifyPageTitle", () => {
  it("saca tildes y signos", () => {
    expect(slugifyPageTitle("¿Quién soy?")).toBe("quien-soy");
    expect(slugifyPageTitle("  Hola   Mundo!! ")).toBe("hola-mundo");
    expect(slugifyPageTitle("a".repeat(80))).toHaveLength(60);
  });
});

describe("RESERVED_SITE_SEGMENTS", () => {
  it("cubre cada carpeta real bajo app/w/[workspaceSlug]", () => {
    const dir = path.join(process.cwd(), "app/w/[workspaceSlug]");
    const carpetas = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !/[()[\]]/.test(e.name))
      .map((e) => e.name);
    for (const c of carpetas) expect(RESERVED_SITE_SEGMENTS).toContain(c);
  });
  it("incluye los extras fijos", () => {
    for (const x of ["trabajos", "testimonio", "testimonios", "presupuesto", "insertar", "api", "w"]) {
      expect(RESERVED_SITE_SEGMENTS).toContain(x);
    }
  });
  it("rechaza todo segmento que en el dominio propio se manda a FOTOFFICE", () => {
    for (const s of FOTOFFICE_ONLY_SEGMENTS) {
      expect(RESERVED_SITE_SEGMENTS).toContain(s);
      expect(validatePageSlug(s, [])).not.toBeNull();
    }
    expect(validatePageSlug("privacidad", [])).toBe("Esa dirección ya la usa el sitio");
  });
  it("incluye las páginas de módulos y opcionales del sitio (SITE_RESERVED_SEGMENTS)", () => {
    for (const s of SITE_RESERVED_SEGMENTS) expect(RESERVED_SITE_SEGMENTS).toContain(s);
  });
});

describe("nextPageKey", () => {
  it("empieza en p_1 y elige la primera libre", () => {
    expect(nextPageKey([])).toBe("p_1");
    expect(nextPageKey(["p_1", "p_2"])).toBe("p_3");
    expect(nextPageKey(["p_2"])).toBe("p_1");
    expect(nextPageKey(["home", "p_1", "p_3"])).toBe("p_2");
  });
});

describe("claves de página con formato seguro", () => {
  it("parseWebsiteSections descarta claves con formato raro o de prototipo", () => {
    const raw = JSON.parse(
      JSON.stringify({
        pages: { home: [], "Mala Clave": [], "../x": [], ok: [] },
        pageMeta: {
          "Mala Clave": { slug: "a", title: "A" },
          "../x": { slug: "b", title: "B" },
          ok: { slug: "c", title: "C" },
        },
      }).replace('"ok"', '"__proto__"').replace('"ok"', '"__proto__"'),
    );
    const s = parseWebsiteSections(raw);
    expect(Object.keys(s.pages)).toEqual(["home"]);
    expect(s.pageMeta).toEqual({});
  });
});
