import { z } from "zod";
import type { WebsiteBlock } from "./blocks";
import { deriveHomeNavItems } from "./navigation";
import { OPTIONAL_PUBLIC_PAGES, PUBLIC_MODULE_PAGES, optionalPublicPagesFor, publicModulePagesFor } from "./public-modules";
import { buildSiteNav, type SiteNavItem } from "./site-nav";

/**
 * El menú corregido a mano por el dueño — la "etapa 2" de la sección 6 del spec del sitio
 * público. Se guarda en `FotofficeWorkspaceWebsite.navJson` (borrador) y se congela en la
 * versión al publicar, igual que las secciones y el diseño.
 *
 * Reglas (las del spec):
 * - `navJson` vacío, o con la forma vieja que sembraba `ensureWebsiteDraft`, es "nunca lo
 *   tocó": el menú se arma solo con `buildSiteNav`, exactamente como antes.
 * - Una vez editado, lo que el dueño ordenó no se reordena nunca. Una página automática nueva
 *   (un módulo que se enciende después) se agrega al final.
 * - Una página de un módulo apagado, o una sección que se borró, desaparece del menú público
 *   sola — sin links rotos. Si el módulo vuelve, el ítem vuelve en su lugar.
 *
 * Sin submenús por ahora: el menú editado es plano.
 *
 * Todo es puro: nada consulta la base, así se prueba entero (ver `site-menu.test.ts`).
 */

export const SITE_MENU_VERSION = 2;
export const SITE_MENU_MAX_ITEMS = 30;
export const SITE_MENU_LABEL_MAX = 40;

const etiqueta = z.string().trim().max(SITE_MENU_LABEL_MAX);

/**
 * Qué direcciones acepta un link del menú. Nunca `javascript:` ni nada que no sea navegar:
 * lo que se guarda acá termina como `href` en el sitio público que ve cualquiera.
 */
export function isSafeMenuUrl(url: string): boolean {
  const u = url.trim();
  if (u.length === 0 || u.length > 500) return false;
  return (
    /^https?:\/\/[^\s/]+[^\s]*$/i.test(u) ||
    /^mailto:[^\s]+$/i.test(u) ||
    /^tel:[+\d\s()-]+$/i.test(u) ||
    /^\/(?!\/)[^\s]*$/.test(u)
  );
}

/** Lo que el dueño escribe a mano ("instagram.com/sfpr") se completa con `https://`. */
export function normalizeMenuUrl(raw: string): string {
  const u = raw.trim();
  if (u === "" || /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("/")) return u;
  return `https://${u}`;
}

const base = { id: z.string().min(1).max(64), hidden: z.boolean() };

const pageEntrySchema = z.object({
  ...base,
  kind: z.literal("page"),
  /** `"home"`, el `moduleKey` de una página de módulo, o la `key` de una página opcional. */
  page: z.string().min(1).max(64),
  /** `null` = el nombre de siempre. */
  label: etiqueta.nullable(),
});

const sectionEntrySchema = z.object({
  ...base,
  kind: z.literal("section"),
  blockId: z.string().min(1).max(64),
  label: etiqueta.nullable(),
});

const linkEntrySchema = z.object({
  ...base,
  kind: z.literal("link"),
  label: etiqueta.min(1),
  url: z.string().trim().refine(isSafeMenuUrl, "Dirección no válida"),
  newTab: z.boolean(),
});

const siteMenuEntrySchema = z.discriminatedUnion("kind", [pageEntrySchema, sectionEntrySchema, linkEntrySchema]);

/** Esquema estricto, para lo que llega del constructor al guardar. */
export const siteMenuSchema = z.object({
  version: z.literal(SITE_MENU_VERSION),
  items: z.array(siteMenuEntrySchema).max(SITE_MENU_MAX_ITEMS),
});

export type SiteMenuEntry = z.infer<typeof siteMenuEntrySchema>;
export type SiteMenu = z.infer<typeof siteMenuSchema>;

/**
 * Tolerante, para lo que se lee de la base: un ítem roto se descarta solo y el resto sigue.
 * Devuelve `null` si el menú nunca se editó (vacío o con la forma vieja), que es la señal para
 * armarlo solo.
 */
export function parseSiteMenu(raw: unknown): SiteMenu | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as { version?: unknown; items?: unknown };
  if (obj.version !== SITE_MENU_VERSION || !Array.isArray(obj.items)) return null;

  const vistos = new Set<string>();
  const items: SiteMenuEntry[] = [];
  for (const crudo of obj.items) {
    const parsed = siteMenuEntrySchema.safeParse(crudo);
    if (!parsed.success || vistos.has(parsed.data.id)) continue;
    vistos.add(parsed.data.id);
    items.push(parsed.data);
    if (items.length >= SITE_MENU_MAX_ITEMS) break;
  }
  return { version: SITE_MENU_VERSION, items };
}

export type MenuPageOption = {
  page: string;
  label: string;
  /** Ruta bajo `/w/[slug]`; vacía para Inicio. */
  path: string;
  /** Las automáticas entran solas al menú; las opcionales sólo si el dueño las suma. */
  automatic: boolean;
};

/** Las páginas que se pueden poner en el menú con los módulos habilitados hoy. */
export function availableMenuPages(enabledModuleKeys: ReadonlySet<string>): MenuPageOption[] {
  return [
    { page: "home", label: "Inicio", path: "", automatic: true },
    ...publicModulePagesFor(enabledModuleKeys).map((p) => ({
      page: p.moduleKey,
      label: p.label,
      path: p.segment,
      automatic: true,
    })),
    ...optionalPublicPagesFor(enabledModuleKeys).map((p) => ({
      page: p.key,
      label: p.label,
      path: p.path,
      automatic: false,
    })),
  ];
}

/** El nombre de siempre de una página, aunque su módulo esté apagado (para el editor). */
export function menuPageDefaultLabel(page: string): string | null {
  const todos = new Set<string>([
    ...PUBLIC_MODULE_PAGES.map((p) => p.moduleKey),
    ...OPTIONAL_PUBLIC_PAGES.flatMap((p) => (p.moduleKey ? [p.moduleKey] : [])),
  ]);
  return availableMenuPages(todos).find((p) => p.page === page)?.label ?? null;
}

export type MenuSectionOption = { blockId: string; label: string; anchor: string };

/** Las secciones de la portada a las que se puede saltar (visibles y con título). */
export function availableMenuSections(homeBlocks: WebsiteBlock[]): MenuSectionOption[] {
  return deriveHomeNavItems(homeBlocks)
    .filter((item): item is typeof item & { anchor: string } => item.anchor !== null)
    .map((item) => ({ blockId: item.id, label: item.label, anchor: item.anchor }));
}

function pageEntry(page: string): SiteMenuEntry {
  return { id: `page:${page}`, kind: "page", page, label: null, hidden: false };
}

/**
 * El menú completo tal como se edita: lo guardado, más al final las páginas automáticas que no
 * figuran (un módulo encendido después de editar el menú). Sin nada guardado, son las páginas
 * automáticas en su orden de siempre.
 *
 * No saca las páginas de módulos apagados: siguen guardadas para volver a su lugar si el módulo
 * se enciende de nuevo. Quien las esconde es `resolveSiteNav`.
 */
export function materializeSiteMenu(menu: SiteMenu | null, enabledModuleKeys: ReadonlySet<string>): SiteMenu {
  const items = menu ? [...menu.items] : [];
  const presentes = new Set(items.flatMap((i) => (i.kind === "page" ? [i.page] : [])));
  for (const opcion of availableMenuPages(enabledModuleKeys)) {
    if (opcion.automatic && !presentes.has(opcion.page)) items.push(pageEntry(opcion.page));
  }
  return { version: SITE_MENU_VERSION, items: items.slice(0, SITE_MENU_MAX_ITEMS) };
}

/**
 * El menú que ve el visitante. Sin menú editado es `buildSiteNav` tal cual (con las secciones
 * colgando de Inicio); con menú editado, es la lista plana del dueño sin lo que ya no existe.
 */
export function resolveSiteNav(input: {
  workspaceSlug: string;
  homeBlocks: WebsiteBlock[];
  enabledModuleKeys: ReadonlySet<string>;
  hasPublishedSite: boolean;
  menu: SiteMenu | null;
}): SiteNavItem[] {
  if (!input.menu) return buildSiteNav(input);

  const base = `/w/${input.workspaceSlug}`;
  const paginas = new Map(availableMenuPages(input.enabledModuleKeys).map((p) => [p.page, p]));
  const secciones = new Map(
    (input.hasPublishedSite ? availableMenuSections(input.homeBlocks) : []).map((s) => [s.blockId, s]),
  );

  const nav: SiteNavItem[] = [];
  for (const entry of materializeSiteMenu(input.menu, input.enabledModuleKeys).items) {
    if (entry.hidden) continue;
    if (entry.kind === "page") {
      const pagina = paginas.get(entry.page);
      if (!pagina) continue;
      nav.push({
        id: entry.id,
        label: entry.label || pagina.label,
        href: pagina.path ? `${base}/${pagina.path}` : base,
        exact: pagina.page === "home",
        children: [],
      });
    } else if (entry.kind === "section") {
      const seccion = secciones.get(entry.blockId);
      if (!seccion) continue;
      nav.push({ id: entry.id, label: entry.label || seccion.label, href: `${base}#${seccion.anchor}`, children: [] });
    } else {
      nav.push({ id: entry.id, label: entry.label, href: entry.url, newTab: entry.newTab, children: [] });
    }
  }
  return nav;
}

/**
 * El menú para las vistas previas del panel: ahí no hay sitio público al que ir, así que cada
 * enlace salta sólo dentro de la misma vista (las secciones a su ancla; lo demás a ningún lado).
 */
export function toPreviewNav(items: SiteNavItem[]): SiteNavItem[] {
  return items.map((item) => {
    const ancla = item.href.indexOf("#");
    return {
      ...item,
      href: ancla >= 0 ? item.href.slice(ancla) : "#",
      newTab: false,
      children: toPreviewNav(item.children),
    };
  });
}
