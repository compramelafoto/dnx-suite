import type {
  AlbumDashboardLegacyTabId,
  AlbumPublicationPanelId,
} from "@/lib/albums/album-dashboard-nav";
import {
  ALBUM_PUBLICATION_DEFAULT_PANEL,
  parseLegacyAlbumTabFromQuery,
  parsePublicationPanelFromQuery,
  type ParseLegacyAlbumTabOptions,
} from "@/lib/albums/album-dashboard-nav";

/** Alias de URL → tab canónica del dashboard. */
const TAB_ALIASES: Record<string, AlbumDashboardLegacyTabId> = {
  productos: "packs",
  "productos-y-packs": "packs",
  "pre-venta": "preventa",
  preventa: "preventa",
  "vista-comercial-unificada": "vista-comercial",
  "vista-comercial": "vista-comercial",
  adicionales: "adicionales",
  upsell: "adicionales",
  "comision-escolar": "comision-escolar",
  comisiones: "comision-escolar",
  "contenido/fotos": "fotos",
  "contenido-fotos": "fotos",
  "contenido/videos": "videos",
  "contenido-videos": "videos",
  publicacion: "publicacion",
  "publicacion/compartir": "publicacion",
  "publicacion-compartir": "publicacion",
  "publicacion/visibilidad": "publicacion",
  "publicacion-visibilidad": "publicacion",
  "publicacion/proteccion": "publicacion",
  "publicacion-proteccion": "publicacion",
  "publicacion/portada": "publicacion",
  "publicacion-portada": "publicacion",
  configuracion: "configuracion",
  config: "configuracion",
  settings: "configuracion",
};

/** Alias de tab publicación → panel interno (`?pub=`). */
const PUBLICATION_TAB_ALIASES: Record<string, AlbumPublicationPanelId> = {
  "publicacion/compartir": "compartir",
  "publicacion-compartir": "compartir",
  "publicacion/visibilidad": "visibilidad",
  "publicacion-visibilidad": "visibilidad",
  "publicacion/proteccion": "proteccion",
  "publicacion-proteccion": "proteccion",
  "publicacion/portada": "portada",
  "publicacion-portada": "portada",
};

export function normalizeAlbumDashboardTabRaw(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (TAB_ALIASES[lower]) return TAB_ALIASES[lower];
  return lower;
}

export function resolvePublicationPanelFromTabAlias(
  rawTab: string | null | undefined
): AlbumPublicationPanelId | null {
  if (!rawTab) return null;
  return PUBLICATION_TAB_ALIASES[rawTab.trim().toLowerCase()] ?? null;
}

export function normalizeAlbumDashboardTab(
  raw: string | null | undefined,
  opts: ParseLegacyAlbumTabOptions
): AlbumDashboardLegacyTabId | null {
  const normalized = normalizeAlbumDashboardTabRaw(raw);
  if (!normalized) return null;
  return parseLegacyAlbumTabFromQuery(normalized, opts);
}

export function resolveAlbumPublicationPanel(
  rawTab: string | null | undefined,
  rawPub: string | null | undefined
): AlbumPublicationPanelId {
  return (
    resolvePublicationPanelFromTabAlias(rawTab) ??
    parsePublicationPanelFromQuery(rawPub) ??
    ALBUM_PUBLICATION_DEFAULT_PANEL
  );
}

export function buildAlbumDashboardTabSearchParams(
  tab: AlbumDashboardLegacyTabId,
  current: URLSearchParams,
  extras?: { pub?: AlbumPublicationPanelId | null }
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.set("tab", tab);

  if (tab === "publicacion") {
    const pub = extras?.pub ?? ALBUM_PUBLICATION_DEFAULT_PANEL;
    if (pub && pub !== ALBUM_PUBLICATION_DEFAULT_PANEL) {
      next.set("pub", pub);
    } else {
      next.delete("pub");
    }
  } else {
    next.delete("pub");
  }

  return next;
}

export function buildAlbumDashboardTabHref(
  pathname: string,
  tab: AlbumDashboardLegacyTabId,
  current: URLSearchParams,
  extras?: { pub?: AlbumPublicationPanelId | null }
): string {
  const qs = buildAlbumDashboardTabSearchParams(tab, current, extras).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function albumDashboardTabQueryMatches(
  raw: string | null | undefined,
  tab: AlbumDashboardLegacyTabId,
  opts: ParseLegacyAlbumTabOptions
): boolean {
  return normalizeAlbumDashboardTab(raw, opts) === tab;
}

export function albumDashboardLocationHref(pathname: string, searchString: string): string {
  return searchString ? `${pathname}?${searchString}` : pathname;
}

export function albumDashboardTabUrlNeedsReplace(
  rawTab: string | null,
  resolvedTab: AlbumDashboardLegacyTabId,
  opts: ParseLegacyAlbumTabOptions,
  resolvedPub?: AlbumPublicationPanelId
): boolean {
  if (rawTab == null) return false;
  const urlTab = normalizeAlbumDashboardTab(rawTab, opts);
  if (urlTab !== resolvedTab) return true;
  if (rawTab.trim().toLowerCase() !== resolvedTab) return true;

  if (resolvedTab === "publicacion" && resolvedPub) {
    const aliasPanel = resolvePublicationPanelFromTabAlias(rawTab);
    if (aliasPanel && aliasPanel !== resolvedPub) return true;
  }

  return false;
}

export function logAlbumTabSync(
  reason: string,
  detail: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[album-tab-sync]", { reason, ...detail });
}
