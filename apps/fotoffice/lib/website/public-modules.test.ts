import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { describe, expect, it } from "vitest";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PRINT_ORDERS_MODULE_KEY } from "@/lib/impresiones/constantes";
import { buildSiteNav } from "./site-nav";
import { personVocabulary } from "@/lib/vocabulario/personas";
import {
  OPTIONAL_PUBLIC_PAGES,
  PUBLIC_MODULE_PAGES,
  optionalPublicPagesFor,
  resolvePublicModuleLabel,
  SITE_RESERVED_SEGMENTS,
  isSiteSegmentReserved,
  publicModulePagesFor,
  withStoreOpenState,
  withTestimoniosPage,
  withTrabajosPage,
} from "./public-modules";
import { resolveSiteNav, SITE_MENU_VERSION, type SiteMenu } from "./site-menu";

describe("publicModulePagesFor", () => {
  it("sin ningún módulo habilitado no devuelve ninguna página", () => {
    expect(publicModulePagesFor(new Set())).toEqual([]);
  });

  it("devuelve sólo las páginas de los módulos habilitados", () => {
    const paginas = publicModulePagesFor(new Set([BOOKINGS_MODULE_KEY]));
    expect(paginas.map((p) => p.segment)).toEqual(["reservas"]);
  });

  it("las devuelve ordenadas por 'order', no por el orden del Set", () => {
    const paginas = publicModulePagesFor(
      new Set([MEMBERS_MODULE_KEY, COURSES_SALES_MODULE_KEY, BOOKINGS_MODULE_KEY]),
    );
    const orders = paginas.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("un módulo habilitado que no tiene página pública no aporta nada", () => {
    expect(publicModulePagesFor(new Set(["evaluaciones"]))).toEqual([]);
  });
});

describe("SITE_RESERVED_SEGMENTS", () => {
  it("incluye el segmento de cada página de módulo — se deriva, no se escribe a mano", () => {
    for (const pagina of PUBLIC_MODULE_PAGES) {
      expect(SITE_RESERVED_SEGMENTS).toContain(pagina.segment);
    }
  });

  it("no tiene segmentos repetidos", () => {
    expect(new Set(SITE_RESERVED_SEGMENTS).size).toBe(SITE_RESERVED_SEGMENTS.length);
  });
});

describe("isSiteSegmentReserved", () => {
  it("reconoce un segmento de módulo", () => {
    expect(isSiteSegmentReserved("cursos")).toBe(true);
  });

  it("no distingue mayúsculas ni espacios al borde", () => {
    expect(isSiteSegmentReserved("  Cursos ")).toBe(true);
  });

  it("deja pasar un nombre libre", () => {
    expect(isSiteSegmentReserved("nosotros")).toBe(false);
  });
});

describe("la página pública de portfolios", () => {
  const pagina = () => PUBLIC_MODULE_PAGES.find((p) => p.moduleKey === PORTFOLIO_MODULE_KEY)!;

  it("ocupa el segmento /socios", () => {
    expect(pagina().segment).toBe("socios");
  });

  it("su segmento queda reservado: una página del dueño no puede taparlo", () => {
    expect(isSiteSegmentReserved("socios")).toBe(true);
    expect(SITE_RESERVED_SEGMENTS).toContain("socios");
  });

  it("con el módulo apagado no entra al menú", () => {
    const paginas = publicModulePagesFor(new Set([COURSES_SALES_MODULE_KEY]));
    expect(paginas.some((p) => p.segment === "socios")).toBe(false);
  });

  it("con el módulo encendido sí", () => {
    const paginas = publicModulePagesFor(new Set([PORTFOLIO_MODULE_KEY]));
    expect(paginas.map((p) => p.segment)).toEqual(["socios"]);
  });
});

describe("resolvePublicModuleLabel", () => {
  const portfolios = () => PUBLIC_MODULE_PAGES.find((p) => p.moduleKey === PORTFOLIO_MODULE_KEY)!;

  it("la etiqueta sigue el vocabulario de la institución", () => {
    const vocab = personVocabulary({ singular: "voluntario", plural: "voluntarios" });
    expect(resolvePublicModuleLabel(portfolios(), vocab)).toBe("Voluntarios");
  });

  it("sin vocabulario propio, queda la palabra de por omisión", () => {
    expect(resolvePublicModuleLabel(portfolios(), personVocabulary(null))).toBe("Socios");
  });

  it("una página sin vocabulario declarado conserva su etiqueta fija", () => {
    const cursos = PUBLIC_MODULE_PAGES.find((p) => p.segment === "cursos")!;
    const vocab = personVocabulary({ singular: "voluntario", plural: "voluntarios" });
    expect(resolvePublicModuleLabel(cursos, vocab)).toBe("Cursos");
  });

  it("la DIRECCIÓN no sigue al vocabulario: cambiar la palabra no rompe enlaces publicados", () => {
    const vocab = personVocabulary({ singular: "voluntario", plural: "voluntarios" });
    resolvePublicModuleLabel(portfolios(), vocab);
    expect(portfolios().segment).toBe("socios");
  });
});

describe("la página pública de la tienda", () => {
  it("ocupa /tienda, se llama Tienda y va después de Asociarse", () => {
    expect(PUBLIC_MODULE_PAGES.find((p) => p.moduleKey === STORE_MODULE_KEY)).toEqual({
      moduleKey: STORE_MODULE_KEY,
      segment: "tienda",
      label: "Tienda",
      order: 35,
    });
    expect(isSiteSegmentReserved("tienda")).toBe(true);
  });

  it("módulo encendido y tienda abierta → entra al menú", () => {
    const claves = withStoreOpenState(new Set([STORE_MODULE_KEY, SALES_MODULE_KEY]), true);
    expect(publicModulePagesFor(claves).map((p) => p.segment)).toEqual(["tienda"]);
  });

  it("módulo encendido pero tienda cerrada → no entra al menú, y el resto sigue igual", () => {
    const claves = withStoreOpenState(new Set([STORE_MODULE_KEY, SALES_MODULE_KEY, BOOKINGS_MODULE_KEY]), false);
    expect(publicModulePagesFor(claves).map((p) => p.segment)).toEqual(["reservas"]);
  });

  it("abierta pero con el módulo apagado → tampoco", () => {
    expect(publicModulePagesFor(withStoreOpenState(new Set([SALES_MODULE_KEY]), true))).toEqual([]);
  });

  it("abierta y encendida pero con Ventas apagado → tampoco (la tienda vende el catálogo de Ventas)", () => {
    const claves = withStoreOpenState(new Set([STORE_MODULE_KEY, BOOKINGS_MODULE_KEY]), true);
    expect(publicModulePagesFor(claves).map((p) => p.segment)).toEqual(["reservas"]);
  });
});

describe("la página «Pedí tu presupuesto»", () => {
  it("es opcional (no automática), ocupa /presupuesto, ligada a Consultas, y su segmento queda reservado", () => {
    expect(PUBLIC_MODULE_PAGES.some((p) => p.segment === "presupuesto")).toBe(false);
    expect(OPTIONAL_PUBLIC_PAGES.find((p) => p.key === "presupuesto")).toMatchObject({
      moduleKey: SERVICE_LEADS_MODULE_KEY,
      path: "presupuesto",
      label: "Pedí tu presupuesto",
    });
    expect(isSiteSegmentReserved("presupuesto")).toBe(true);
  });

  it("no entra sola al menú automático, ni con Consultas encendido", () => {
    const menu = (claves: string[]) =>
      buildSiteNav({ workspaceSlug: "dnx-estudio", homeBlocks: [], enabledModuleKeys: new Set(claves), hasPublishedSite: true });
    expect(menu([SERVICE_LEADS_MODULE_KEY]).some((i) => i.href.endsWith("/presupuesto"))).toBe(false);
  });

  it("con Consultas encendido se ofrece para sumar al menú a mano; apagado, no", () => {
    const opciones = (claves: string[]) => optionalPublicPagesFor(new Set(claves)).map((p) => p.key);
    expect(opciones([SERVICE_LEADS_MODULE_KEY])).toContain("presupuesto");
    expect(opciones([])).not.toContain("presupuesto");
  });
});

describe("el probador de cuadros", () => {
  it("se ofrece para sumar al menú en cualquier sitio, sin depender de un módulo", () => {
    expect(optionalPublicPagesFor(new Set()).map((p) => p.key)).toContain("probador");
  });

  it("no entra solo al menú de quien no vende impresiones", () => {
    const menu = buildSiteNav({ workspaceSlug: "dnx-estudio", homeBlocks: [], enabledModuleKeys: new Set(), hasPublishedSite: true });
    expect(menu.some((i) => i.href.endsWith("/probador-de-cuadros"))).toBe(false);
  });

  it("con Pedidos de impresión entra solo al menú, también al que el dueño ya había editado", () => {
    const claves = new Set([PRINT_ORDERS_MODULE_KEY]);
    const automatico = buildSiteNav({ workspaceSlug: "dnx-estudio", homeBlocks: [], enabledModuleKeys: claves, hasPublishedSite: true });
    expect(automatico.some((i) => i.href === "/w/dnx-estudio/probador-de-cuadros")).toBe(true);

    const editado: SiteMenu = {
      version: SITE_MENU_VERSION,
      items: [{ id: "page:home", kind: "page", page: "home", label: null, hidden: false }],
    };
    const nav = resolveSiteNav({ workspaceSlug: "dnx-estudio", homeBlocks: [], enabledModuleKeys: claves, hasPublishedSite: true, menu: editado });
    expect(nav.map((i) => i.label)).toEqual(["Inicio", "Probador de cuadros"]);
  });

  it("con Pedidos de impresión no se ofrece dos veces para agregar", () => {
    expect(optionalPublicPagesFor(new Set([PRINT_ORDERS_MODULE_KEY])).map((p) => p.key)).not.toContain("probador");
  });

  it("su dirección queda reservada para que ninguna página propia la pise", () => {
    expect(isSiteSegmentReserved("probador-de-cuadros")).toBe(true);
  });
});

describe("la página pública de Trabajos", () => {
  const menu = (hayTrabajos: boolean) =>
    buildSiteNav({
      workspaceSlug: "dnx-estudio",
      homeBlocks: [],
      enabledModuleKeys: withTrabajosPage(new Set([BOOKINGS_MODULE_KEY]), hayTrabajos),
      hasPublishedSite: true,
    });

  it("con al menos un trabajo publicado entra sola al menú automático, como «Trabajos»", () => {
    const item = menu(true).find((i) => i.href === "/w/dnx-estudio/trabajos");
    expect(item?.label).toBe("Trabajos");
  });

  it("sin trabajos publicados no entra al menú (sería un ítem que lleva a una página vacía)", () => {
    expect(menu(false).some((i) => i.href.endsWith("/trabajos"))).toBe(false);
  });

  it("con un menú editado a mano, aparece al final sólo si hay trabajos", () => {
    const editado: SiteMenu = { version: SITE_MENU_VERSION, items: [{ id: "page:home", kind: "page" as const, page: "home", label: null, hidden: false }] };
    const nav = (hay: boolean) =>
      resolveSiteNav({
        workspaceSlug: "dnx-estudio",
        homeBlocks: [],
        enabledModuleKeys: withTrabajosPage(new Set(), hay),
        hasPublishedSite: true,
        menu: editado,
      });
    expect(nav(true).map((i) => i.href)).toContain("/w/dnx-estudio/trabajos");
    expect(nav(false).map((i) => i.href)).not.toContain("/w/dnx-estudio/trabajos");
  });

  it("no toca el resto de los módulos ni el conjunto que recibe", () => {
    const claves = new Set([BOOKINGS_MODULE_KEY]);
    withTrabajosPage(claves, true);
    expect([...claves]).toEqual([BOOKINGS_MODULE_KEY]);
  });

  it("su segmento queda reservado", () => {
    expect(isSiteSegmentReserved("trabajos")).toBe(true);
  });
});

describe("la página pública de Testimonios", () => {
  const menu = (hay: boolean) =>
    buildSiteNav({
      workspaceSlug: "dnx-estudio",
      homeBlocks: [],
      enabledModuleKeys: withTestimoniosPage(new Set([BOOKINGS_MODULE_KEY]), hay),
      hasPublishedSite: true,
    });

  it("con al menos un testimonio publicado entra sola al menú automático, como «Testimonios»", () => {
    const item = menu(true).find((i) => i.href === "/w/dnx-estudio/testimonios");
    expect(item?.label).toBe("Testimonios");
  });

  it("sin testimonios publicados no entra al menú", () => {
    expect(menu(false).some((i) => i.href.endsWith("/testimonios"))).toBe(false);
  });

  it("no toca el conjunto que recibe y su segmento queda reservado", () => {
    const claves = new Set([BOOKINGS_MODULE_KEY]);
    withTestimoniosPage(claves, true);
    expect([...claves]).toEqual([BOOKINGS_MODULE_KEY]);
    expect(isSiteSegmentReserved("testimonios")).toBe(true);
  });
});
