import { describe, expect, it } from "vitest";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { createEmptyBlock, updateHeroSlide, type HeroBlock, type WebsiteBlock } from "./blocks";
import { personVocabulary } from "@/lib/vocabulario/personas";
import { buildSiteNav, isPathCurrent } from "./site-nav";

function heroConTitulo(titulo: string): WebsiteBlock {
  const hero = createEmptyBlock("HERO", 0) as HeroBlock;
  return { ...hero, config: updateHeroSlide(hero.config, hero.config.slides[0].id, { title: titulo }) };
}

const base = {
  workspaceSlug: "mi-estudio",
  homeBlocks: [] as WebsiteBlock[],
  enabledModuleKeys: new Set<string>(),
  hasPublishedSite: true,
};

describe("buildSiteNav", () => {
  it("sin módulos ni secciones, el menú es sólo Inicio", () => {
    const nav = buildSiteNav(base);
    expect(nav).toHaveLength(1);
    expect(nav[0]).toMatchObject({ id: "home", label: "Inicio", href: "/w/mi-estudio" });
    expect(nav[0].children).toEqual([]);
  });

  it("las secciones de la portada cuelgan de Inicio como submenú", () => {
    const nav = buildSiteNav({ ...base, homeBlocks: [heroConTitulo("Sobre nosotros")] });
    expect(nav[0].children).toHaveLength(1);
    expect(nav[0].children[0]).toMatchObject({
      label: "Sobre nosotros",
      href: "/w/mi-estudio#sobre-nosotros",
    });
  });

  it("sin sitio publicado, Inicio no tiene submenú aunque haya secciones en el borrador", () => {
    const nav = buildSiteNav({
      ...base,
      homeBlocks: [heroConTitulo("Sobre nosotros")],
      hasPublishedSite: false,
    });
    expect(nav[0].children).toEqual([]);
  });

  it("un módulo habilitado agrega su página al menú", () => {
    const nav = buildSiteNav({ ...base, enabledModuleKeys: new Set([BOOKINGS_MODULE_KEY]) });
    expect(nav.map((i) => i.label)).toEqual(["Inicio", "Reservas"]);
    expect(nav[1].href).toBe("/w/mi-estudio/reservas");
  });

  it("un módulo NO habilitado no aparece en el menú", () => {
    const nav = buildSiteNav({ ...base, enabledModuleKeys: new Set([BOOKINGS_MODULE_KEY]) });
    expect(nav.map((i) => i.label)).not.toContain("Cursos");
  });

  it("con artículos publicados, el blog aparece en el menú después de los módulos", () => {
    const nav = buildSiteNav({ ...base, enabledModuleKeys: new Set([BOOKINGS_MODULE_KEY]), hasPublishedBlog: true });
    expect(nav.map((i) => i.label)).toEqual(["Inicio", "Reservas", "Blog"]);
    expect(nav[2].href).toBe("/w/mi-estudio/blog");
  });

  it("sin artículos publicados, el blog no va al menú", () => {
    expect(buildSiteNav({ ...base, hasPublishedBlog: false }).map((i) => i.label)).toEqual(["Inicio"]);
    expect(buildSiteNav(base).map((i) => i.label)).toEqual(["Inicio"]);
  });
});

// `buildSiteNav` no marca ningún ítem como actual — corre en el servidor y no conoce la ruta
// del visitante (ver el comentario en `website-header-nav-client.tsx`). Quien de verdad marca
// es `WebsiteHeaderNavClient`, con `usePathname()` y esta misma función. Estas pruebas verifican
// la regla directamente sobre `isPathCurrent`, la función que corre de verdad.
describe("isPathCurrent", () => {
  it("marca como actual la página de módulo en la que estás, y desmarca Inicio", () => {
    expect(isPathCurrent("/w/mi-estudio/cursos", "/w/mi-estudio/cursos", { exact: false })).toBe(true);
    expect(isPathCurrent("/w/mi-estudio/cursos", "/w/mi-estudio", { exact: true })).toBe(false);
  });

  it("una ruta más profunda marca igual a su página de módulo", () => {
    expect(isPathCurrent("/w/mi-estudio/cursos/taller-de-retrato", "/w/mi-estudio/cursos", { exact: false })).toBe(true);
  });

  it("una barra final no cambia qué ítem está marcado", () => {
    expect(isPathCurrent("/w/mi-estudio/cursos/", "/w/mi-estudio/cursos", { exact: false })).toBe(true);
  });
});

describe("buildSiteNav y el vocabulario de la institución", () => {
  it("la entrada de portfolios usa la palabra del workspace", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set(["portfolio"]),
      personVocabulary: personVocabulary({ singular: "voluntario", plural: "voluntarios" }),
    });
    expect(nav.find((i) => i.id === "portfolio")?.label).toBe("Voluntarios");
  });

  it("sin vocabulario propio queda la palabra de por omisión", () => {
    const nav = buildSiteNav({ ...base, enabledModuleKeys: new Set(["portfolio"]) });
    expect(nav.find((i) => i.id === "portfolio")?.label).toBe("Socios");
  });

  it("la dirección es /socios aunque la palabra sea otra", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set(["portfolio"]),
      personVocabulary: personVocabulary({ singular: "alumno", plural: "alumnos" }),
    });
    expect(nav.find((i) => i.id === "portfolio")?.href).toBe("/w/mi-estudio/socios");
  });
});
