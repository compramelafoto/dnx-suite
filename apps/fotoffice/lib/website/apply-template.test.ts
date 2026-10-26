import { describe, expect, it } from "vitest";
import { aplicarPlantilla, type SitioParaPlantilla } from "./apply-template";
import { createEmptyBlock, websiteSectionsSchema, type WebsiteBlock } from "./blocks";
import { DEFAULT_DESIGN_PRESETS } from "./design-presets";
import { MAX_CUSTOM_PAGES } from "./save-pages";
import { siteMenuSchema, SITE_MENU_VERSION, type SiteMenu } from "./site-menu";
import { getWebsiteTemplate } from "./templates";

const eventos = getWebsiteTemplate("eventos")!;
const oscura = getWebsiteTemplate("oscura")!;

function texto(id: string, content: string): WebsiteBlock {
  const b = createEmptyBlock("TEXT", 0);
  return { ...b, id, config: { title: "", content, align: "left" } } as WebsiteBlock;
}

function sitioVacio(): SitioParaPlantilla {
  return { sections: { pages: { home: [] }, pageMeta: {} }, design: DEFAULT_DESIGN_PRESETS, menu: null };
}

/** Un sitio con portada propia y una página «Quién soy» ya escrita. */
function sitioConQuienSoy(clave = "quien_soy"): SitioParaPlantilla {
  return {
    sections: {
      pages: { home: [texto("mio-1", "Mi portada")], [clave]: [texto("mio-2", "Mi historia, escrita por mí")] },
      pageMeta: { [clave]: { slug: "quien-soy", title: "Sobre mí de verdad" } },
    },
    design: { ...DEFAULT_DESIGN_PRESETS, menuLayout: "drawer", menuSide: "left", logoSizePx: 72, loginButtonLabel: "Socios" },
    menu: {
      version: SITE_MENU_VERSION,
      items: [
        { id: "page:home", kind: "page", page: "home", label: "Inicio", hidden: false },
        { id: `custom:${clave}`, kind: "custom", pageKey: clave, label: null, hidden: false },
      ],
    },
  };
}

const slugs = (s: SitioParaPlantilla) => Object.values(s.sections.pageMeta).map((m) => m.slug);

describe("aplicarPlantilla — sólo el diseño", () => {
  it("cambia el diseño y no toca páginas, bloques ni menú", () => {
    const actual = sitioConQuienSoy();
    const r = aplicarPlantilla(actual, eventos, "solo-diseno");
    expect(r.sections).toEqual(actual.sections);
    expect(r.menu).toEqual(actual.menu);
    expect(r.design.headerPreset).toBe(eventos.design.headerPreset);
    expect(r.design.typographyPreset).toBe(eventos.design.typographyPreset);
    expect(r.paginasAgregadas).toEqual([]);
  });

  it("conserva la disposición del menú, el tamaño del logo y el texto del botón para entrar", () => {
    const r = aplicarPlantilla(sitioConQuienSoy(), eventos, "solo-diseno");
    expect(r.design.menuLayout).toBe("drawer");
    expect(r.design.menuSide).toBe("left");
    expect(r.design.logoSizePx).toBe(72);
    expect(r.design.loginButtonLabel).toBe("Socios");
  });

  it("no muta lo que recibe", () => {
    const actual = sitioConQuienSoy();
    const copia = structuredClone(actual);
    aplicarPlantilla(actual, eventos, "todo", { aplicarColoresSugeridos: true });
    expect(actual).toEqual(copia);
  });
});

describe("aplicarPlantilla — diseño y páginas que falten", () => {
  it("Review Focus 1: un sitio que ya tiene quien-soy no la duplica ni la pisa", () => {
    const actual = sitioConQuienSoy();
    const r = aplicarPlantilla(actual, eventos, "diseno-y-paginas");
    expect(r.sections.pages.quien_soy).toEqual(actual.sections.pages.quien_soy);
    expect(r.sections.pageMeta.quien_soy).toEqual({ slug: "quien-soy", title: "Sobre mí de verdad" });
    expect(slugs(r).filter((s) => s === "quien-soy")).toHaveLength(1);
    expect(r.paginasSalteadas).toContain("quien-soy");
    // La que faltaba sí se agrega.
    expect(slugs(r)).toContain("pedi-tu-presupuesto");
    expect(r.paginasAgregadas).toEqual(["pedi-tu-presupuesto"]);
  });

  it("la reconoce por la dirección aunque esté guardada con otra clave", () => {
    const r = aplicarPlantilla(sitioConQuienSoy("p_1"), eventos, "diseno-y-paginas");
    expect(slugs(r).filter((s) => s === "quien-soy")).toHaveLength(1);
    expect(r.sections.pages.p_1).toEqual([texto("mio-2", "Mi historia, escrita por mí")]);
    expect(r.sections.pages.quien_soy).toBeUndefined();
  });

  it("si la clave está ocupada por otra página, la nueva va con una clave libre y no pisa nada", () => {
    const actual = sitioConQuienSoy();
    actual.sections.pageMeta.quien_soy = { slug: "mi-historia", title: "Mi historia" };
    const r = aplicarPlantilla(actual, eventos, "diseno-y-paginas");
    expect(r.sections.pageMeta.quien_soy).toEqual({ slug: "mi-historia", title: "Mi historia" });
    expect(r.sections.pages.quien_soy).toEqual(actual.sections.pages.quien_soy);
    const nueva = Object.entries(r.sections.pageMeta).find(([, m]) => m.slug === "quien-soy");
    expect(nueva?.[0]).toBe("p_1");
    expect(r.sections.pages.p_1.length).toBeGreaterThan(0);
  });

  it("no pisa la portada con contenido; una portada vacía sí recibe la de la plantilla", () => {
    const conPortada = aplicarPlantilla(sitioConQuienSoy(), eventos, "diseno-y-paginas");
    expect(conPortada.sections.pages.home).toEqual([texto("mio-1", "Mi portada")]);
    expect(conPortada.portadaSembrada).toBe(false);

    const vacio = sitioVacio();
    vacio.sections.pageMeta.p_1 = { slug: "algo", title: "Algo" };
    vacio.sections.pages.p_1 = [texto("x", "y")];
    const sinPortada = aplicarPlantilla(vacio, eventos, "diseno-y-paginas");
    expect(sinPortada.sections.pages.home.map((b) => b.type)).toEqual(eventos.paginas[0].bloques.map((b) => b.type));
    expect(sinPortada.portadaSembrada).toBe(true);
  });

  it("con menú editado, suma al final las páginas agregadas; sin menú editado lo deja automático", () => {
    const r = aplicarPlantilla(sitioConQuienSoy(), eventos, "diseno-y-paginas");
    const ultimas = r.menu!.items.slice(-1);
    const clave = Object.entries(r.sections.pageMeta).find(([, m]) => m.slug === "pedi-tu-presupuesto")![0];
    expect(ultimas).toEqual([{ id: `custom:${clave}`, kind: "custom", pageKey: clave, label: null, hidden: false }]);
    expect(r.menu!.items.slice(0, 2)).toEqual(sitioConQuienSoy().menu!.items);

    const sinMenu = { ...sitioConQuienSoy(), menu: null };
    expect(aplicarPlantilla(sinMenu, eventos, "diseno-y-paginas").menu).toBeNull();
  });

  it("respeta el tope de páginas propias", () => {
    const actual = sitioVacio();
    for (let i = 1; i <= MAX_CUSTOM_PAGES; i++) {
      actual.sections.pageMeta[`p_${i}`] = { slug: `pagina-${i}`, title: `Página ${i}` };
      actual.sections.pages[`p_${i}`] = [];
    }
    const r = aplicarPlantilla(actual, eventos, "diseno-y-paginas");
    expect(Object.keys(r.sections.pageMeta)).toHaveLength(MAX_CUSTOM_PAGES);
    expect(r.paginasAgregadas).toEqual([]);
  });

  it("los bloques agregados son copias: editarlos no cambia la plantilla", () => {
    const r = aplicarPlantilla(sitioVacio(), eventos, "diseno-y-paginas");
    const hero = r.sections.pages.home[0];
    if (hero.type !== "HERO") throw new Error("se esperaba un Hero");
    hero.config.slides[0].title = "cambiado";
    const original = eventos.paginas[0].bloques[0];
    expect(original.type === "HERO" && original.config.slides[0].title).not.toBe("cambiado");
  });
});

describe("aplicarPlantilla — todo (sitio vacío)", () => {
  it("arma el sitio completo: portada, páginas, menú y diseño de la plantilla", () => {
    const r = aplicarPlantilla(sitioVacio(), eventos, "todo");
    expect(websiteSectionsSchema.safeParse(r.sections).success).toBe(true);
    expect(slugs(r)).toEqual(["quien-soy", "pedi-tu-presupuesto"]);
    expect(r.sections.pages.home).toHaveLength(eventos.paginas[0].bloques.length);
    expect(siteMenuSchema.safeParse(r.menu).success).toBe(true);
    expect(r.menu).toEqual(eventos.menu);
    expect(r.design).toEqual(eventos.design);
  });

  it("aun en «todo», nunca pisa ni borra lo que ya había, y el menú editado se conserva", () => {
    const actual = sitioConQuienSoy();
    const r = aplicarPlantilla(actual, eventos, "todo");
    expect(r.sections.pages.home).toEqual(actual.sections.pages.home);
    expect(r.sections.pages.quien_soy).toEqual(actual.sections.pages.quien_soy);
    expect(r.sections.pageMeta.quien_soy).toEqual(actual.sections.pageMeta.quien_soy);
    expect(r.menu!.items.slice(0, 2)).toEqual(actual.menu!.items);
  });

  it("si una clave del menú de la plantilla cambió, el menú apunta a la clave nueva", () => {
    const actual = sitioVacio();
    actual.sections.pageMeta.quien_soy = { slug: "otra-cosa", title: "Otra cosa" };
    actual.sections.pages.quien_soy = [texto("a", "b")];
    const r = aplicarPlantilla(actual, eventos, "todo");
    const claves = r.menu!.items.flatMap((i) => (i.kind === "custom" ? [i.pageKey] : []));
    for (const clave of claves) expect(Object.hasOwn(r.sections.pageMeta, clave)).toBe(true);
    const claveQuienSoy = Object.entries(r.sections.pageMeta).find(([, m]) => m.slug === "quien-soy")![0];
    expect(claves).toContain(claveQuienSoy);
    expect(claveQuienSoy).not.toBe("quien_soy");
  });

  it("el menú nunca supera el máximo", () => {
    const actual = sitioVacio();
    const items: SiteMenu["items"] = Array.from({ length: 30 }, (_, i) => ({
      id: `link:${i}`,
      kind: "link" as const,
      label: `L${i}`,
      url: "https://ejemplo.com",
      newTab: false,
      hidden: false,
    }));
    actual.menu = { version: SITE_MENU_VERSION, items };
    const r = aplicarPlantilla(actual, eventos, "todo");
    expect(r.menu!.items).toHaveLength(30);
    expect(siteMenuSchema.safeParse(r.menu).success).toBe(true);
  });
});

describe("aplicarPlantilla — colores sugeridos (Review Focus 5)", () => {
  it("sin la confirmación explícita, nunca devuelve colores para guardar", () => {
    for (const modo of ["solo-diseno", "diseno-y-paginas", "todo"] as const) {
      expect(aplicarPlantilla(sitioVacio(), oscura, modo, { aplicarColoresSugeridos: false }).colores).toBeNull();
      expect(aplicarPlantilla(sitioVacio(), oscura, modo).colores).toBeNull();
    }
  });

  it("con la confirmación, devuelve los colores de la plantilla", () => {
    const r = aplicarPlantilla(sitioVacio(), oscura, "solo-diseno", { aplicarColoresSugeridos: true });
    expect(r.colores).toEqual(oscura.coloresSugeridos);
  });

  it("una plantilla sin colores sugeridos no cambia los colores aunque se confirme", () => {
    const institucion = getWebsiteTemplate("institucion")!;
    expect(aplicarPlantilla(sitioVacio(), institucion, "todo", { aplicarColoresSugeridos: true }).colores).toBeNull();
  });
});
