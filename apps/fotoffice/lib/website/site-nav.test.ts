import { describe, expect, it } from "vitest";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { createEmptyBlock, updateHeroSlide, type HeroBlock, type WebsiteBlock } from "./blocks";
import { buildSiteNav } from "./site-nav";

function heroConTitulo(titulo: string): WebsiteBlock {
  const hero = createEmptyBlock("HERO", 0) as HeroBlock;
  return { ...hero, config: updateHeroSlide(hero.config, hero.config.slides[0].id, { title: titulo }) };
}

const base = {
  workspaceSlug: "mi-estudio",
  homeBlocks: [] as WebsiteBlock[],
  enabledModuleKeys: new Set<string>(),
  currentPath: "/w/mi-estudio",
  hasPublishedSite: true,
};

describe("buildSiteNav", () => {
  it("sin módulos ni secciones, el menú es sólo Inicio", () => {
    const nav = buildSiteNav(base);
    expect(nav).toHaveLength(1);
    expect(nav[0]).toMatchObject({ id: "home", label: "Inicio", href: "/w/mi-estudio", current: true });
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

  it("marca como actual la página de módulo en la que estás, y desmarca Inicio", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set([COURSES_SALES_MODULE_KEY]),
      currentPath: "/w/mi-estudio/cursos",
    });
    expect(nav[0].current).toBe(false);
    expect(nav[1]).toMatchObject({ label: "Cursos", current: true });
  });

  it("una ruta más profunda marca igual a su página de módulo", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set([COURSES_SALES_MODULE_KEY]),
      currentPath: "/w/mi-estudio/cursos/taller-de-retrato",
    });
    expect(nav[1].current).toBe(true);
  });

  it("una barra final no cambia qué ítem está marcado", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set([COURSES_SALES_MODULE_KEY]),
      currentPath: "/w/mi-estudio/cursos/",
    });
    expect(nav[1].current).toBe(true);
  });
});
