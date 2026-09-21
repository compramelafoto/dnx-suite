import type { WebsiteBlock } from "./blocks";
import { deriveHomeNavItems } from "./navigation";
import { publicModulePagesFor } from "./public-modules";

/**
 * El menú del sitio público. Se arma solo: Inicio, las secciones de la portada como submenú, y
 * una entrada por módulo habilitado con página pública.
 *
 * Es una función pura a propósito: el layout le pasa lo que ya resolvió (secciones publicadas,
 * módulos habilitados, ruta actual) y acá no se consulta nada. Así se puede probar entera sin
 * base de datos ni request, que es lo único que los tests de esta app saben hacer.
 *
 * `navJson` — el menú corregido a mano por el dueño — todavía no se lee: es la etapa 2. Cuando
 * llegue, se aplica ENCIMA de lo que devuelve esta función, nunca en lugar de.
 */
export type SiteNavItem = {
  id: string;
  label: string;
  href: string;
  /** La página que el visitante está mirando. Un padre lo hereda de sus hijos. */
  current: boolean;
  children: SiteNavItem[];
};

/** Sin la barra final, para que `/cursos` y `/cursos/` sean la misma ruta. */
function normalizar(path: string): string {
  const limpio = path.replace(/\/+$/, "");
  return limpio === "" ? "/" : limpio;
}

export function buildSiteNav(input: {
  workspaceSlug: string;
  homeBlocks: WebsiteBlock[];
  enabledModuleKeys: ReadonlySet<string>;
  currentPath: string;
  /** Sin versión publicada no hay secciones que anclar: Inicio va sin submenú. */
  hasPublishedSite: boolean;
}): SiteNavItem[] {
  const base = `/w/${input.workspaceSlug}`;
  const actual = normalizar(input.currentPath);

  // Las anclas de la portada sólo tienen sentido estando en la portada: desde otra página,
  // `#seccion` no llevaría a ningún lado. Por eso el href lleva siempre la ruta completa.
  const secciones: SiteNavItem[] = input.hasPublishedSite
    ? deriveHomeNavItems(input.homeBlocks)
        .filter((item) => item.anchor !== null)
        .map((item) => ({
          id: item.id,
          label: item.label,
          href: `${base}#${item.anchor}`,
          current: false,
          children: [],
        }))
    : [];

  const inicio: SiteNavItem = {
    id: "home",
    label: "Inicio",
    href: base,
    current: actual === normalizar(base),
    children: secciones,
  };

  const paginasDeModulo: SiteNavItem[] = publicModulePagesFor(input.enabledModuleKeys).map((pagina) => {
    const href = `${base}/${pagina.segment}`;
    // Una ruta más profunda (el detalle de un curso) marca igual a su página de módulo.
    const esActual = actual === normalizar(href) || actual.startsWith(`${normalizar(href)}/`);
    return { id: pagina.moduleKey, label: pagina.label, href, current: esActual, children: [] };
  });

  return [inicio, ...paginasDeModulo];
}
