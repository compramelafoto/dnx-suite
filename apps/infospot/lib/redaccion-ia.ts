/**
 * Arquitectura de información de la Redacción (sala de prensa).
 * Solo UX/navegación: no cambia modelos ni workflows.
 */

export type NewsroomNavId =
  | "centro"
  | "bandeja"
  | "material"
  | "agenda"
  | "publicados"
  | "portada"
  | "estadisticas";

export type NewsroomNavItem = {
  id: NewsroomNavId;
  href: string;
  label: string;
  short: string;
  exact?: boolean;
  /** Descripción corta para tooltips / ayuda. */
  hint: string;
};

/** Navegación principal orientada al trabajo del redactor. */
export const NEWSROOM_NAV: readonly NewsroomNavItem[] = [
  {
    id: "centro",
    href: "/redaccion",
    label: "Centro Editorial",
    short: "CE",
    exact: true,
    hint: "Mesa de trabajo del día",
  },
  {
    id: "bandeja",
    href: "/redaccion/bandeja",
    label: "Bandeja",
    short: "Ba",
    hint: "Borradores, revisión y pendientes",
  },
  {
    id: "material",
    href: "/redaccion/coberturas",
    label: "Material",
    short: "Ma",
    hint: "Coberturas fotográficas y material disponible",
  },
  {
    id: "agenda",
    href: "/redaccion/eventos",
    label: "Agenda",
    short: "Ag",
    hint: "Próximos eventos y convocatorias",
  },
  {
    id: "publicados",
    href: "/redaccion/bandeja?vista=publicadas",
    label: "Publicados",
    short: "Pu",
    hint: "Notas y piezas ya visibles",
  },
  {
    id: "portada",
    href: "/redaccion/distribucion",
    label: "Portada",
    short: "Po",
    hint: "Qué se destaca en la home",
  },
  {
    id: "estadisticas",
    href: "/redaccion#estadisticas",
    label: "Estadísticas",
    short: "Es",
    exact: true,
    hint: "Resumen de actividad editorial",
  },
] as const;

/** Glosario UX: términos técnicos → lenguaje de redacción. */
export const NEWSROOM_COPY = {
  album: "cobertura fotográfica",
  albums: "coberturas fotográficas",
  material: "material editorial",
  coverageCenter: "Material editorial",
  clfImport: "Importar desde ComprameLaFoto",
  createNote: "Crear nota",
  continueDraft: "Continuar borrador",
  createCoverage: "Abrir material",
  newsroom: "Centro Editorial",
  inbox: "Bandeja",
  agenda: "Agenda",
} as const;

/** Flujo mental documentado (preparación del Wizard futuro). */
export const NEWSROOM_WORK_FLOW = [
  "Inbox",
  "En preparación",
  "Escribiendo",
  "En revisión",
  "Publicados",
  "Archivados",
] as const;

export function newsroomNavActive(
  pathname: string,
  search: string,
  item: NewsroomNavItem,
): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (item.id === "centro") {
    return path === "/redaccion";
  }
  if (item.id === "bandeja") {
    return path === "/redaccion/bandeja" && params.get("vista") !== "publicadas";
  }
  if (item.id === "publicados") {
    return path === "/redaccion/bandeja" && params.get("vista") === "publicadas";
  }
  if (item.id === "estadisticas") {
    return path === "/redaccion";
  }
  if (item.id === "material") {
    return path === "/redaccion/coberturas" || path.startsWith("/redaccion/coberturas/");
  }
  if (item.id === "agenda") {
    return path === "/redaccion/eventos" || path.startsWith("/redaccion/eventos/");
  }
  if (item.id === "portada") {
    return path.startsWith("/redaccion/distribucion");
  }
  if (item.exact) return path === item.href.split("?")[0];
  const base = item.href.split("?")[0]!;
  return path === base || path.startsWith(`${base}/`);
}
