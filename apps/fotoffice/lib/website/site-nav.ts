import type { WebsiteBlock } from "./blocks";
import { deriveHomeNavItems } from "./navigation";
import { publicModulePagesFor } from "./public-modules";

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
 * `navJson` — el menú corregido a mano por el dueño — todavía no se lee: es la etapa 2. Cuando
 * llegue, se aplica ENCIMA de lo que devuelve esta función, nunca en lugar de.
 */
export type SiteNavItem = {
  id: string;
  label: string;
  href: string;
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
    children: secciones,
  };

  const paginasDeModulo: SiteNavItem[] = publicModulePagesFor(input.enabledModuleKeys).map((pagina) => {
    const href = `${base}/${pagina.segment}`;
    return { id: pagina.moduleKey, label: pagina.label, href, children: [] };
  });

  return [inicio, ...paginasDeModulo];
}
