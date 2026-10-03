import type { WebsiteBlock } from "./blocks";
import { deriveHomeNavItems } from "./navigation";
import { BLOG_PUBLIC_PAGE_KEY } from "./constants";
import { publicModulePagesFor, resolvePublicModuleLabel } from "./public-modules";
import { personVocabulary, type PersonVocabulary } from "@/lib/vocabulario/personas";

/**
 * El menú del sitio público. Se arma solo: Inicio, las secciones de la portada como submenú, y
 * una entrada por módulo habilitado con página pública.
 *
 * Es una función pura a propósito: el layout le pasa lo que ya resolvió (secciones publicadas,
 * módulos habilitados) y acá no se consulta nada. Así se puede probar entera sin base de datos
 * ni request, que es lo único que los tests de esta app saben hacer.
 *
 * No calcula cuál ítem es "el actual": eso lo resuelve `WebsiteHeaderNavClient` en el navegador,
 * con `usePathname()` (ver el comentario ahí y `isPathCurrent` más abajo).
 *
 * `navJson` — el menú corregido a mano por el dueño — se aplica en `resolveSiteNav`
 * (`site-menu.ts`): si nunca se editó, el menú es exactamente lo que devuelve esta función.
 */
export type SiteNavItem = {
  id: string;
  label: string;
  href: string;
  /** Marca de "actual" por igualdad exacta y no por prefijo (Inicio; ver `isPathCurrent`). */
  exact?: boolean;
  /** Link externo que el dueño pidió abrir en otra pestaña. */
  newTab?: boolean;
  children: SiteNavItem[];
};

/** Sin la barra final, para que `/cursos` y `/cursos/` sean la misma ruta. */
function normalizar(path: string): string {
  const limpio = path.replace(/\/+$/, "");
  return limpio === "" ? "/" : limpio;
}

/**
 * La regla de coincidencia entre una ruta y el href de un ítem del menú: "Inicio" compara por
 * igualdad exacta (si no, cualquier ruta del sitio lo marcaría a él también, por ser prefijo de
 * todas); el resto por prefijo, así una ruta más profunda —el detalle de un curso— sigue
 * marcando a la página de su módulo.
 *
 * Exportada porque la usa `WebsiteHeaderNavClient` (`website-header-nav-client.tsx`), el único
 * lugar que sabe la ruta real del navegador (`usePathname`) — acá no se calcula nada con ella.
 */
export function isPathCurrent(pathname: string, href: string, options: { exact: boolean }): boolean {
  const actual = normalizar(pathname);
  const objetivo = normalizar(href);
  return options.exact ? actual === objetivo : actual === objetivo || actual.startsWith(`${objetivo}/`);
}

export function buildSiteNav(input: {
  workspaceSlug: string;
  homeBlocks: WebsiteBlock[];
  enabledModuleKeys: ReadonlySet<string>;
  /** Sin versión publicada no hay secciones que anclar: Inicio va sin submenú. */
  hasPublishedSite: boolean;
  /**
   * Si la institución tiene al menos un artículo publicado (y el Sitio web habilitado). Un blog
   * vacío no va al menú: sería un ítem que lleva a "todavía no hay artículos".
   */
  hasPublishedBlog?: boolean;
  /**
   * Cómo llama esta institución a la gente de su padrón. Las páginas de módulo que lo declaran
   * toman su etiqueta de acá; el resto conserva la fija. Omitirlo deja las palabras por omisión,
   * así ningún caller viejo cambia de comportamiento.
   */
  personVocabulary?: PersonVocabulary;
}): SiteNavItem[] {
  const base = `/w/${input.workspaceSlug}`;

  // Las anclas de la portada sólo tienen sentido estando en la portada: desde otra página,
  // `#seccion` no llevaría a ningún lado. Por eso el href lleva siempre la ruta completa.
  const secciones: SiteNavItem[] = input.hasPublishedSite
    ? deriveHomeNavItems(input.homeBlocks)
        .filter((item) => item.anchor !== null)
        .map((item) => ({
          id: item.id,
          label: item.label,
          href: `${base}#${item.anchor}`,
          children: [],
        }))
    : [];

  const inicio: SiteNavItem = {
    id: "home",
    label: "Inicio",
    href: base,
    exact: true,
    children: secciones,
  };

  // El blog entra por la misma lista que los módulos (orden, segmento, etiqueta), "habilitado"
  // con su llave propia cuando tiene artículos. Así no hay un segundo camino para armar el menú.
  const paginasHabilitadas = input.hasPublishedBlog
    ? new Set([...input.enabledModuleKeys, BLOG_PUBLIC_PAGE_KEY])
    : input.enabledModuleKeys;

  const vocabulario = input.personVocabulary ?? personVocabulary(null);
  const paginasDeModulo: SiteNavItem[] = publicModulePagesFor(paginasHabilitadas).map((pagina) => {
    const href = `${base}/${pagina.segment}`;
    return {
      id: pagina.moduleKey,
      label: resolvePublicModuleLabel(pagina, vocabulario),
      href,
      children: [],
    };
  });

  return [inicio, ...paginasDeModulo];
}
