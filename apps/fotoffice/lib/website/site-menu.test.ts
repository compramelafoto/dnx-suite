import { describe, expect, it } from "vitest";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { createEmptyBlock, updateHeroSlide, type HeroBlock, type WebsiteBlock } from "./blocks";
import { buildSiteNav } from "./site-nav";
import {
  availableMenuPages,
  isSafeMenuUrl,
  materializeSiteMenu,
  normalizeMenuUrl,
  parseSiteMenu,
  resolveSiteNav,
  siteMenuSchema,
  type SiteMenu,
  type SiteMenuEntry,
} from "./site-menu";

function heroConTitulo(titulo: string): WebsiteBlock {
  const hero = createEmptyBlock("HERO", 0) as HeroBlock;
  return { ...hero, config: updateHeroSlide(hero.config, hero.config.slides[0].id, { title: titulo }) };
}

const page = (p: string, extra: Partial<SiteMenuEntry> = {}): SiteMenuEntry =>
  ({ id: `page:${p}`, kind: "page", page: p, label: null, hidden: false, ...extra }) as SiteMenuEntry;

const menu = (...items: SiteMenuEntry[]): SiteMenu => ({ version: 2, items });

const base = {
  workspaceSlug: "sfpr",
  homeBlocks: [] as WebsiteBlock[],
  enabledModuleKeys: new Set<string>([BOOKINGS_MODULE_KEY]),
  hasPublishedSite: true,
};

describe("parseSiteMenu", () => {
  it("vacío o con la forma vieja que sembraba el borrador es 'nunca se editó'", () => {
    expect(parseSiteMenu(null)).toBeNull();
    expect(parseSiteMenu({})).toBeNull();
    expect(parseSiteMenu({ items: [{ id: "home", label: "Home", type: "home" }] })).toBeNull();
    expect(parseSiteMenu("basura")).toBeNull();
  });

  it("descarta un ítem roto sin tirar el resto", () => {
    const parsed = parseSiteMenu({
      version: 2,
      items: [page("home"), { id: "x", kind: "link", label: "Malo", url: "javascript:alert(1)", newTab: false, hidden: false }],
    });
    expect(parsed?.items.map((i) => i.id)).toEqual(["page:home"]);
  });

  it("descarta ids repetidos", () => {
    const parsed = parseSiteMenu({ version: 2, items: [page("home"), page("home")] });
    expect(parsed?.items).toHaveLength(1);
  });
});

describe("isSafeMenuUrl / normalizeMenuUrl", () => {
  it("acepta web, mail, teléfono y rutas del propio sitio", () => {
    for (const u of ["https://instagram.com/sfpr", "http://x.com", "mailto:a@b.com", "tel:+54 341 555", "/w/sfpr/xv"]) {
      expect(isSafeMenuUrl(u)).toBe(true);
    }
  });

  it("rechaza lo que no es navegar", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,hola", "//otro.com", "", "https://"]) {
      expect(isSafeMenuUrl(u)).toBe(false);
    }
  });

  it("completa con https:// lo que se escribe sin protocolo", () => {
    expect(normalizeMenuUrl("instagram.com/sfpr")).toBe("https://instagram.com/sfpr");
    expect(normalizeMenuUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(normalizeMenuUrl("/w/sfpr")).toBe("/w/sfpr");
  });

  it("el esquema estricto no deja guardar un link inseguro", () => {
    const r = siteMenuSchema.safeParse(
      menu({ id: "l", kind: "link", label: "X", url: "javascript:alert(1)", newTab: false, hidden: false }),
    );
    expect(r.success).toBe(false);
  });
});

describe("availableMenuPages", () => {
  it("las páginas opcionales sólo aparecen con su módulo encendido; Ingresar siempre", () => {
    const sin = availableMenuPages(new Set()).map((p) => p.page);
    expect(sin).toContain("entrar");
    expect(sin).not.toContain("raffles");
    const con = availableMenuPages(new Set([RAFFLES_MODULE_KEY])).map((p) => p.page);
    expect(con).toContain("raffles");
  });
});

describe("materializeSiteMenu", () => {
  it("sin menú guardado son las páginas automáticas en su orden", () => {
    const m = materializeSiteMenu(null, new Set([COURSES_SALES_MODULE_KEY, BOOKINGS_MODULE_KEY]));
    expect(m.items.map((i) => i.id)).toEqual(["page:home", "page:courses-sales", "page:bookings"]);
  });

  it("una página automática nueva va al final, sin reordenar lo del dueño", () => {
    const guardado = menu(page(BOOKINGS_MODULE_KEY), page("home"));
    const m = materializeSiteMenu(guardado, new Set([BOOKINGS_MODULE_KEY, COURSES_SALES_MODULE_KEY]));
    expect(m.items.map((i) => i.id)).toEqual(["page:bookings", "page:home", "page:courses-sales"]);
  });

  it("una página escondida no se vuelve a agregar", () => {
    const guardado = menu(page("home"), page(BOOKINGS_MODULE_KEY, { hidden: true }));
    const m = materializeSiteMenu(guardado, new Set([BOOKINGS_MODULE_KEY]));
    expect(m.items).toHaveLength(2);
  });
});

describe("resolveSiteNav", () => {
  it("sin menú editado es exactamente el menú automático de siempre", () => {
    const input = { ...base, homeBlocks: [heroConTitulo("Nosotros")] };
    expect(resolveSiteNav({ ...input, menu: null })).toEqual(buildSiteNav(input));
  });

  it("respeta orden, nombres y ocultos del dueño", () => {
    const nav = resolveSiteNav({
      ...base,
      menu: menu(page(BOOKINGS_MODULE_KEY, { label: "Turnos" }), page("home", { hidden: true })),
    });
    expect(nav.map((i) => [i.label, i.href])).toEqual([["Turnos", "/w/sfpr/reservas"]]);
  });

  it("la página de un módulo apagado desaparece, sin link roto", () => {
    const nav = resolveSiteNav({
      ...base,
      enabledModuleKeys: new Set(),
      menu: menu(page("home"), page(BOOKINGS_MODULE_KEY)),
    });
    expect(nav.map((i) => i.label)).toEqual(["Inicio"]);
  });

  it("una sección borrada desaparece; una que existe salta a su ancla", () => {
    const nosotros = heroConTitulo("Nosotros");
    const nav = resolveSiteNav({
      ...base,
      homeBlocks: [nosotros],
      menu: menu(
        { id: "s1", kind: "section", blockId: nosotros.id, label: null, hidden: false },
        { id: "s2", kind: "section", blockId: "ya-no-existe", label: null, hidden: false },
      ),
    });
    const secciones = nav.filter((i) => i.id.startsWith("s"));
    expect(secciones).toEqual([{ id: "s1", label: "Nosotros", href: "/w/sfpr#nosotros", children: [] }]);
  });

  it("los links externos van tal cual, con su pestaña nueva", () => {
    const nav = resolveSiteNav({
      ...base,
      menu: menu({ id: "ig", kind: "link", label: "Instagram", url: "https://instagram.com/sfpr", newTab: true, hidden: false }),
    });
    expect(nav.find((i) => i.id === "ig")).toMatchObject({ href: "https://instagram.com/sfpr", newTab: true });
  });

  it("la página de portfolios usa la palabra de la institución, también en el menú editado", () => {
    const vocabulario = { singular: "voluntario", plural: "voluntarios", Singular: "Voluntario", Plural: "Voluntarios" };
    const comun = { ...base, enabledModuleKeys: new Set([PORTFOLIO_MODULE_KEY]), personVocabulary: vocabulario };
    expect(resolveSiteNav({ ...comun, menu: null }).map((i) => i.label)).toContain("Voluntarios");
    expect(resolveSiteNav({ ...comun, menu: menu(page("home")) }).map((i) => i.label)).toContain("Voluntarios");
  });

  it("Inicio se marca por igualdad exacta", () => {
    const nav = resolveSiteNav({ ...base, menu: menu(page("home")) });
    expect(nav[0]).toMatchObject({ href: "/w/sfpr", exact: true });
  });
});
