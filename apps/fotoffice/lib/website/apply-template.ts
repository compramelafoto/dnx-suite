import type { WebsiteBlock, WebsiteSections } from "./blocks";
import type { WebsiteColors } from "./branding-defaults";
import type { WebsiteDesignPresets } from "./design-presets";
import { HOME_PAGE_KEY, nextPageKey } from "./pages";
import { MAX_CUSTOM_PAGES } from "./save-pages";
import { SITE_MENU_MAX_ITEMS, type SiteMenu, type SiteMenuEntry } from "./site-menu";
import type { SiteTemplate } from "./templates";

/**
 * Aplicar una plantilla a un sitio. PURO: no lee ni escribe la base; quien guarda es el
 * constructor con su autoguardado de siempre.
 *
 * La regla de oro: una plantilla NUNCA pisa ni borra contenido del usuario. Lo único que
 * reemplaza es el diseño (estilos de encabezado, botones, letra, animación, pie). Según el modo:
 *
 * - `solo-diseno`: sólo el diseño. Es lo de siempre para un sitio con contenido.
 * - `diseno-y-paginas`: el diseño + las páginas de muestra que falten. Una página «falta» si
 *   ninguna página propia usa ya su dirección (`quien-soy`); si su clave está ocupada por otra
 *   página, va con una clave libre (`p_N`). La portada se completa sólo si está vacía. Un menú
 *   editado a mano recibe al final las páginas agregadas; uno automático (`null`) queda automático
 *   (ya muestra solo las páginas propias).
 * - `todo`: pensado para un sitio vacío — lo mismo que el anterior, más el menú de la plantilla
 *   si el sitio no tenía menú editado, y la disposición del menú de la plantilla. Aplicado a un
 *   sitio con contenido sigue sin pisar nada.
 *
 * Siempre se conservan la disposición del menú (salvo en `todo`), el tamaño del logo y el texto
 * del botón para entrar: son decisiones del dueño, no del estilo.
 *
 * Los colores sugeridos viven en otra tabla (la marca) y sólo se devuelven si quien llama pasa
 * `aplicarColoresSugeridos: true` — el constructor lo pregunta antes. Sin eso, `colores` es `null`
 * («no tocar»), así nunca se pisa la marca de nadie por accidente.
 */
export type ModoAplicarPlantilla = "solo-diseno" | "diseno-y-paginas" | "todo";

export type SitioParaPlantilla = {
  sections: WebsiteSections;
  design: WebsiteDesignPresets;
  menu: SiteMenu | null;
};

export type OpcionesAplicarPlantilla = {
  /** El usuario confirmó usar los colores sugeridos de la plantilla. */
  aplicarColoresSugeridos?: boolean;
};

export type ResultadoAplicarPlantilla = SitioParaPlantilla & {
  /** Colores a guardar, o `null` para dejar los de siempre. */
  colores: WebsiteColors | null;
  /** Direcciones de las páginas que se agregaron, en el orden de la plantilla. */
  paginasAgregadas: string[];
  /** Direcciones que no se agregaron porque ya existían (o porque se llegó al tope). */
  paginasSalteadas: string[];
  /** La portada estaba vacía y recibió la de la plantilla. */
  portadaSembrada: boolean;
};

export function aplicarPlantilla(
  actual: SitioParaPlantilla,
  plantilla: SiteTemplate,
  modo: ModoAplicarPlantilla,
  opciones: OpcionesAplicarPlantilla = {},
): ResultadoAplicarPlantilla {
  const design: WebsiteDesignPresets = {
    ...plantilla.design,
    typographyLevels: { ...plantilla.design.typographyLevels },
    logoSizePx: actual.design.logoSizePx,
    loginButtonLabel: actual.design.loginButtonLabel,
    showLoginButton: actual.design.showLoginButton,
    ...(modo === "todo" ? {} : { menuLayout: actual.design.menuLayout, menuSide: actual.design.menuSide }),
  };
  const colores = opciones.aplicarColoresSugeridos && plantilla.coloresSugeridos ? { ...plantilla.coloresSugeridos } : null;

  if (modo === "solo-diseno") {
    return { sections: actual.sections, design, menu: actual.menu, colores, paginasAgregadas: [], paginasSalteadas: [], portadaSembrada: false };
  }

  // Copias nuevas de lo de hoy: lo que se devuelve nunca comparte objetos con lo recibido.
  const pages: Record<string, WebsiteBlock[]> = { ...actual.sections.pages };
  const pageMeta = { ...actual.sections.pageMeta };

  const [portada, ...propias] = plantilla.paginas;
  const portadaActual = Object.hasOwn(pages, HOME_PAGE_KEY) ? pages[HOME_PAGE_KEY] : [];
  const portadaSembrada = portada !== undefined && portadaActual.length === 0;
  if (portadaSembrada) pages[HOME_PAGE_KEY] = structuredClone(portada.bloques);

  // Clave de la plantilla → clave final en el sitio (la agregada, o la que ya tenía esa dirección).
  const claveFinal = new Map<string, string>();
  const paginasAgregadas: string[] = [];
  const paginasSalteadas: string[] = [];
  const agregadas: string[] = [];

  for (const pagina of propias) {
    if (!pagina.meta) continue;
    const existente = Object.entries(pageMeta).find(([, meta]) => meta.slug === pagina.meta!.slug);
    if (existente) {
      claveFinal.set(pagina.clave, existente[0]);
      paginasSalteadas.push(pagina.meta.slug);
      continue;
    }
    if (Object.keys(pageMeta).length >= MAX_CUSTOM_PAGES) {
      paginasSalteadas.push(pagina.meta.slug);
      continue;
    }
    const ocupada = Object.hasOwn(pageMeta, pagina.clave) || Object.hasOwn(pages, pagina.clave) || pagina.clave === HOME_PAGE_KEY;
    const clave = ocupada ? nextPageKey([...Object.keys(pageMeta), ...Object.keys(pages)]) : pagina.clave;
    pageMeta[clave] = { ...pagina.meta };
    pages[clave] = structuredClone(pagina.bloques);
    claveFinal.set(pagina.clave, clave);
    paginasAgregadas.push(pagina.meta.slug);
    agregadas.push(clave);
  }

  let menu: SiteMenu | null;
  if (actual.menu) {
    // Un menú editado a mano no se reordena ni se recorta: sólo se suman al final las páginas nuevas.
    const presentes = new Set(actual.menu.items.flatMap((i) => (i.kind === "custom" ? [i.pageKey] : [])));
    const ids = new Set(actual.menu.items.map((i) => i.id));
    const nuevos: SiteMenuEntry[] = agregadas
      .filter((k) => !presentes.has(k) && !ids.has(`custom:${k}`))
      .map((pageKey) => ({ id: `custom:${pageKey}`, kind: "custom", pageKey, label: null, hidden: false }));
    menu = { ...actual.menu, items: [...actual.menu.items, ...nuevos].slice(0, Math.max(SITE_MENU_MAX_ITEMS, actual.menu.items.length)) };
  } else if (modo === "todo") {
    const items: SiteMenuEntry[] = [];
    for (const item of plantilla.menu.items) {
      if (item.kind !== "custom") {
        items.push({ ...item });
        continue;
      }
      const clave = claveFinal.get(item.pageKey);
      if (!clave) continue;
      items.push({ ...item, id: `custom:${clave}`, pageKey: clave });
    }
    menu = { version: plantilla.menu.version, items: items.slice(0, SITE_MENU_MAX_ITEMS) };
  } else {
    menu = null;
  }

  return { sections: { pages, pageMeta }, design, menu, colores, paginasAgregadas, paginasSalteadas, portadaSembrada };
}
