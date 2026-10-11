import { REVIEW_STATUSES, type ReviewStatus } from "./constants";

/**
 * Las secciones del panel de cada persona con sesión.
 *
 * Daniel pidió que todas las funcionalidades estén a la vista, construidas o no: las que todavía
 * no existen (`ready: false`) abren una página que explica qué van a hacer.
 */
export const PANEL_GROUPS = ["CUENTA", "ORGANIZAR", "ADMIN"] as const;
export type PanelGroup = (typeof PANEL_GROUPS)[number];

export const PANEL_GROUP_LABELS: Record<PanelGroup, string> = {
  CUENTA: "Tu cuenta",
  ORGANIZAR: "Para organizar",
  ADMIN: "Administración",
};

export type PanelSectionKey =
  | "inicio" | "muestras" | "proponer" | "perfil" | "envios" | "expositor" | "cobros"
  | "convocatorias" | "concursos" | "curaduria" | "montaje" | "difusion" | "ventas" | "estadisticas"
  | "revision";

export type PanelSection = {
  key: PanelSectionKey;
  label: string;
  href: string;
  group: PanelGroup;
  ready: boolean;
  superAdminOnly: boolean;
};

const s = (key: PanelSectionKey, label: string, href: string, group: PanelGroup, ready = true, superAdminOnly = false): PanelSection =>
  ({ key, label, href, group, ready, superAdminOnly });

export const PANEL_SECTIONS: readonly PanelSection[] = [
  s("inicio", "Inicio", "/panel", "CUENTA"),
  s("muestras", "Mis muestras", "/panel/muestras", "CUENTA"),
  s("proponer", "Proponer muestra", "/panel/proponer", "CUENTA"),
  s("perfil", "Mi perfil de fotógrafo", "/panel/perfil", "CUENTA"),
  s("envios", "Mis envíos", "/panel/envios", "CUENTA"),
  s("expositor", "Dónde expongo", "/panel/expositor", "CUENTA"),
  s("cobros", "Cobros", "/panel/cobros", "CUENTA"),
  s("convocatorias", "Convocatorias", "/panel/convocatorias", "ORGANIZAR"),
  s("concursos", "Concursos", "/panel/concursos", "ORGANIZAR"),
  s("curaduria", "Curaduría", "/panel/curaduria", "ORGANIZAR"),
  s("montaje", "Montaje e impresión", "/panel/montaje", "ORGANIZAR"),
  s("difusion", "Difusión", "/panel/difusion", "ORGANIZAR"),
  s("estadisticas", "Estadísticas", "/panel/estadisticas", "ORGANIZAR"),
  s("revision", "Revisión", "/panel/revision", "ADMIN", true, true),
  // Etapa 8: los pedidos de toda la plataforma. La venta de cada muestra vive dentro de la muestra
  // (`activitySalesHref`), para el dueño y la coorganización.
  s("ventas", "Ventas de la plataforma", "/panel/ventas", "ADMIN", true, true),
];

/** Dónde se maneja la venta de una muestra (capacidad `sales` o `salesFulfill`). */
export function activitySalesHref(activityId: string): string {
  return `/panel/muestras/${encodeURIComponent(activityId)}/ventas`;
}

/** "Ventas" aparece en la muestra para quien enciende la venta o prepara los pedidos. */
export function showActivitySales(p: { canSales: boolean; canFulfill: boolean }): boolean {
  return p.canSales || p.canFulfill;
}

export function panelSections(actor: { isSuperAdmin: boolean }): PanelSection[] {
  return PANEL_SECTIONS.filter((x) => !x.superAdminOnly || actor.isSuperAdmin);
}

export type PanelSectionGroup = { group: PanelGroup; label: string; sections: PanelSection[] };

export function groupedPanelSections(actor: { isSuperAdmin: boolean }): PanelSectionGroup[] {
  const visibles = panelSections(actor);
  return PANEL_GROUPS
    .map((group) => ({ group, label: PANEL_GROUP_LABELS[group], sections: visibles.filter((x) => x.group === group) }))
    .filter((g) => g.sections.length > 0);
}

/** La sección "en preparación" que corresponde a `/panel/<key>`; cualquier otra cosa es 404. */
export function upcomingSection(key: string): PanelSection | null {
  return PANEL_SECTIONS.find((x) => x.key === key && !x.ready) ?? null;
}

export function activeSectionKey(pathname: string): PanelSectionKey | null {
  const limpio = pathname.replace(/\/+$/, "") || "/";
  if (limpio === "/panel") return "inicio";
  const hallada = PANEL_SECTIONS.find((x) => x.href !== "/panel" && (limpio === x.href || limpio.startsWith(`${x.href}/`)));
  return hallada?.key ?? null;
}

/** Cuántas actividades hay en cada estado. Un estado desconocido no se cuenta. */
export function countByStatus(rows: ReadonlyArray<{ reviewStatus: string }>): Record<ReviewStatus, number> {
  const cuenta = Object.fromEntries(REVIEW_STATUSES.map((st) => [st, 0])) as Record<ReviewStatus, number>;
  for (const r of rows) {
    if ((REVIEW_STATUSES as readonly string[]).includes(r.reviewStatus)) cuenta[r.reviewStatus as ReviewStatus] += 1;
  }
  return cuenta;
}
