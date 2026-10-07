/**
 * Catálogos y semillas de Consultas (etapa 1). Módulo PURO: sólo datos y funciones sin base.
 *
 * Lo leen la migración de datos (semillas), el alta, la ficha y la configuración. Los textos
 * van en español rioplatense; los valores guardados, en mayúsculas, como en el CHECK del SQL.
 */
import {
  SERVICE_LEAD_EVENT_TYPES,
  SERVICE_LEAD_EVENT_TYPE_LABELS,
  type ServiceLeadEventType,
} from "@/lib/service-leads/form-definitions";

/**
 * Slug público de DNX Estudio. Mismo valor que `SLUG_DNX` de `lib/campos/semillas.ts` (que no se
 * importa acá porque es de servidor); una prueba verifica que no se separen.
 */
export const SLUG_DNX = "dnx-estudio";

// --- Grupos de categoría ----------------------------------------------------------------------

export const GRUPOS_CONSULTA = ["BODA", "EVENTO", "TRABAJO_CON_FECHA", "TRABAJO_SIN_FECHA"] as const;
export type GrupoConsulta = (typeof GRUPOS_CONSULTA)[number];

export const ETIQUETA_GRUPO: Record<GrupoConsulta, string> = {
  BODA: "Boda",
  EVENTO: "Evento",
  TRABAJO_CON_FECHA: "Trabajo con fecha",
  TRABAJO_SIN_FECHA: "Trabajo sin fecha",
};

export function esGrupoConsulta(v: unknown): v is GrupoConsulta {
  return typeof v === "string" && (GRUPOS_CONSULTA as readonly string[]).includes(v);
}

/** Datos del evento que puede pedir una categoría, según su grupo. */
export const CAMPOS_EVENTO = ["fechaHora", "invitados", "novios", "ceremonia", "recepcion", "lugar", "ciudad"] as const;
export type CampoEvento = (typeof CAMPOS_EVENTO)[number];

export const ETIQUETA_CAMPO_EVENTO: Record<CampoEvento, string> = {
  fechaHora: "Fecha y hora del evento",
  invitados: "Invitados",
  novios: "Novios",
  ceremonia: "Lugar de la ceremonia",
  recepcion: "Lugar de la recepción",
  lugar: "Lugar",
  ciudad: "Ciudad",
};

/**
 * Qué datos pide cada grupo. Origen, referente, valor, cierre previsto y participantes los
 * tienen todas las consultas y no van acá.
 */
export const CAMPOS_POR_GRUPO: Record<GrupoConsulta, readonly CampoEvento[]> = {
  BODA: ["fechaHora", "invitados", "novios", "ceremonia", "recepcion", "ciudad"],
  EVENTO: ["fechaHora", "invitados", "lugar", "ciudad"],
  TRABAJO_CON_FECHA: ["fechaHora", "lugar"],
  TRABAJO_SIN_FECHA: [],
};

export function grupoPide(grupo: GrupoConsulta, campo: CampoEvento): boolean {
  return CAMPOS_POR_GRUPO[grupo].includes(campo);
}

// --- Categorías de contacto -------------------------------------------------------------------

export const CATEGORIAS_CONTACTO = ["CONTACTO", "CLIENTE", "PROVEEDOR", "COLABORADOR"] as const;
export type CategoriaContacto = (typeof CATEGORIAS_CONTACTO)[number];

export const ETIQUETA_CATEGORIA_CONTACTO: Record<CategoriaContacto, string> = {
  CONTACTO: "Contacto",
  CLIENTE: "Cliente",
  PROVEEDOR: "Proveedor",
  COLABORADOR: "Colaborador",
};

/** Un cliente sin perfil (los que ya existían antes de la etapa 1) cuenta como CLIENTE. */
export const CATEGORIA_CONTACTO_SIN_PERFIL: CategoriaContacto = "CLIENTE";
/** Los contactos que nacen de una consulta. */
export const CATEGORIA_CONTACTO_NUEVO: CategoriaContacto = "CONTACTO";

export function esCategoriaContacto(v: unknown): v is CategoriaContacto {
  return typeof v === "string" && (CATEGORIAS_CONTACTO as readonly string[]).includes(v);
}

// --- Semillas ---------------------------------------------------------------------------------

export type SemillaCategoria = {
  name: string;
  group: GrupoConsulta;
  /** El `eventType` viejo que esta categoría reemplaza (formularios y consultas existentes). */
  legacyEventType: ServiceLeadEventType | null;
};

/**
 * Las 21 categorías de DNX en Alboom, con su grupo (`docs/alboom/09-configuracion-real-dnx.md`),
 * en el mismo orden. `legacyEventType` marca la categoría que hereda cada tipo viejo; los que no
 * tienen una propia caen en la de `EQUIVALENCIA_EVENT_TYPE_DNX`.
 */
export const CATEGORIAS_DNX: readonly SemillaCategoria[] = [
  { name: "Fotografía o Video de Cumpleaños de 15", group: "EVENTO", legacyEventType: "XV" },
  { name: "Boda", group: "BODA", legacyEventType: "BODA" },
  { name: "Alquiler plataforma 360°", group: "EVENTO", legacyEventType: null },
  { name: "Stand de Glitter", group: "EVENTO", legacyEventType: null },
  { name: "Sesión de Fotos", group: "TRABAJO_SIN_FECHA", legacyEventType: "SESION_FOTOGRAFICA" },
  { name: "Cumpleaños Infantiles/adultos", group: "EVENTO", legacyEventType: "CUMPLEANOS_ADULTO" },
  { name: "Bautismo", group: "EVENTO", legacyEventType: "EVENTO_RELIGIOSO" },
  { name: "Graduación", group: "EVENTO", legacyEventType: "GRADUACION" },
  { name: "Evento Corporativo", group: "EVENTO", legacyEventType: "OTRO_EVENTO" },
  { name: "Cursos de Fotografía o Video", group: "TRABAJO_SIN_FECHA", legacyEventType: null },
  { name: "Impresiones", group: "TRABAJO_SIN_FECHA", legacyEventType: null },
  { name: "Video Clip", group: "TRABAJO_CON_FECHA", legacyEventType: null },
  { name: "Contacto de proveedor de servicios", group: "TRABAJO_SIN_FECHA", legacyEventType: null },
  { name: "Nuevo Cliente - Dnx Estudio Fotográfico", group: "TRABAJO_SIN_FECHA", legacyEventType: null },
  { name: "Producción de contenido fotográfico y/o audiovisual", group: "TRABAJO_CON_FECHA", legacyEventType: "SHOW" },
  { name: "Cumpleaños Infantil", group: "EVENTO", legacyEventType: "INFANTIL" },
  { name: "Publicidad", group: "TRABAJO_CON_FECHA", legacyEventType: null },
  { name: "Postproducción de Imagenes", group: "TRABAJO_SIN_FECHA", legacyEventType: null },
  { name: "Impresión", group: "TRABAJO_SIN_FECHA", legacyEventType: null },
  { name: "Comunión", group: "TRABAJO_CON_FECHA", legacyEventType: null },
  { name: "Bar Mitzvá.", group: "TRABAJO_CON_FECHA", legacyEventType: null },
];

/** Grupo de cada tipo viejo, para las organizaciones que no son DNX. */
const GRUPO_DE_EVENT_TYPE: Record<ServiceLeadEventType, GrupoConsulta> = {
  XV: "EVENTO",
  BODA: "BODA",
  SESION_FOTOGRAFICA: "TRABAJO_SIN_FECHA",
  EVENTO_RELIGIOSO: "EVENTO",
  SHOW: "EVENTO",
  GRADUACION: "EVENTO",
  INFANTIL: "EVENTO",
  CUMPLEANOS_ADULTO: "EVENTO",
  OTRO_EVENTO: "EVENTO",
};

/** Las demás organizaciones: una categoría por cada uno de los 9 tipos viejos, con su mismo nombre. */
export const CATEGORIAS_EQUIVALENTES: readonly SemillaCategoria[] = SERVICE_LEAD_EVENT_TYPES.map((t) => ({
  name: SERVICE_LEAD_EVENT_TYPE_LABELS[t],
  group: GRUPO_DE_EVENT_TYPE[t],
  legacyEventType: t,
}));

/** Categoría de DNX (por nombre) que hereda cada uno de los 9 tipos viejos. */
export const EQUIVALENCIA_EVENT_TYPE_DNX: Record<ServiceLeadEventType, string> = Object.fromEntries(
  CATEGORIAS_DNX.filter((c) => c.legacyEventType !== null).map((c) => [c.legacyEventType, c.name]),
) as Record<ServiceLeadEventType, string>;

/** Orígenes iniciales de DNX (spec §3.4: el relevamiento de Alboom no listó los 8). */
export const ORIGENES_DNX: readonly string[] = [
  "Instagram",
  "Facebook",
  "Google",
  "Recomendación",
  "Sitio web",
  "WhatsApp",
  "Cliente anterior",
  "Otro",
];

/** Las demás organizaciones arrancan sólo con "Otro". */
export const ORIGENES_EQUIVALENTES: readonly string[] = ["Otro"];

/** Los 16 roles de participante de DNX en Alboom, en el mismo orden. */
export const ROLES_PARTICIPANTE_DNX: readonly string[] = [
  "Fotógrafo Principal",
  "Fotógrafo Secundario",
  "Asistente de Fotógrafo",
  "Filmaker",
  "Maquilladora de Glitter",
  "Maquilladora en Sesión de Fotos",
  "Cliente",
  "Otro",
  "Salón",
  "DJ",
  "Catering",
  "Mesa Dulce",
  "Alquiler de Pantalla",
  "Músicos",
  "Shows para fiesta",
  "Operador de Plataforma",
];

/** Las demás organizaciones arrancan sin roles. */
export const ROLES_PARTICIPANTE_EQUIVALENTES: readonly string[] = [];

export type SemillasConsultas = {
  categorias: readonly SemillaCategoria[];
  origenes: readonly string[];
  roles: readonly string[];
};

/** Qué catálogos recibe una organización según su slug público. */
export function semillasPara(slug: string | null | undefined): SemillasConsultas {
  return slug === SLUG_DNX
    ? { categorias: CATEGORIAS_DNX, origenes: ORIGENES_DNX, roles: ROLES_PARTICIPANTE_DNX }
    : { categorias: CATEGORIAS_EQUIVALENTES, origenes: ORIGENES_EQUIVALENTES, roles: ROLES_PARTICIPANTE_EQUIVALENTES };
}

/**
 * Nombre de la categoría equivalente a un `eventType` viejo dentro de unas semillas: la que lo
 * declara en `legacyEventType`. null si el tipo no es uno de los 9.
 */
export function categoriaEquivalente(
  categorias: readonly SemillaCategoria[],
  eventType: unknown,
): string | null {
  if (typeof eventType !== "string") return null;
  return categorias.find((c) => c.legacyEventType === eventType)?.name ?? null;
}

// --- Topes ------------------------------------------------------------------------------------

/**
 * Filas por importación CSV de consultas: se dan de alta de a una (contacto, consulta, número y
 * circuito cada una), así que 500 entran holgadas en los 300 s de la función.
 */
export const MAX_FILAS_IMPORTACION_CONSULTAS = 500;
/** Consultas viejas que el enganche ata por llamada. */
export const LOTE_ENGANCHE = 50;
