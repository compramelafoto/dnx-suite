/**
 * Constantes de la base Contactos DNX y del agente Buscador. Los conjuntos viven en TEXT con CHECK en
 * la base (como el resto de FOTOFFICE), así que esta es la única lista en el código.
 */

export const TIPOS_CONTACTO = [
  "FOTOGRAFO", "ESCUELA", "CLUB", "ORGANIZADOR_EVENTOS", "ASOCIACION_FOTOGRAFOS",
  "ORGANIZADOR_MUESTRAS", "EMPRESA_TURISMO", "NEGOCIO_FOTOGRAFIA", "OTRO",
] as const;
export type TipoContacto = (typeof TIPOS_CONTACTO)[number];

/** Nichos fijos; además se admite el valor libre `OTRO:<texto>`. */
export const NICHOS = [
  "ESCOLAR", "DEPORTIVA", "TURISTICA", "SOCIAL", "EVENTOS", "FOTO_CARNET", "CORPORATIVA",
  "MASCOTAS_NEWBORN_FAMILIA",
] as const;
export type Nicho = (typeof NICHOS)[number] | `OTRO:${string}`;

export const NICHOS_PRIORITARIOS = ["ESCOLAR", "TURISTICA", "DEPORTIVA"] as const;

/** En el orden en que el Buscador las recorre. */
export const REGIONES = ["CENTRO", "BUENOS_AIRES_AMBA", "CUYO", "NOA", "NEA", "PATAGONIA"] as const;
export type Region = (typeof REGIONES)[number];

export const ESTADOS_CONTACTO = [
  "NUEVO", "REVISADO", "CONTACTADO", "RESPONDIO", "SE_SUMO", "NO_INTERESA", "DESCARTADO", "NO_CONTACTAR",
] as const;
export type EstadoContacto = (typeof ESTADOS_CONTACTO)[number];

export const FUENTES_DATO = ["SITIO_PROPIO", "WEB_SEARCH", "ALBOOM", "MANUAL", "CLF"] as const;
export type FuenteDato = (typeof FUENTES_DATO)[number];

export const PLATAFORMAS = ["CLF", "INFOSPOT", "MUESTRAS", "FOTOFFICE"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

const PLATAFORMAS_POR_TIPO: Record<TipoContacto, Plataforma[]> = {
  FOTOGRAFO: ["CLF", "FOTOFFICE"],
  ESCUELA: ["CLF"],
  CLUB: ["CLF", "INFOSPOT"],
  ORGANIZADOR_EVENTOS: ["INFOSPOT", "CLF"],
  ORGANIZADOR_MUESTRAS: ["MUESTRAS"],
  ASOCIACION_FOTOGRAFOS: ["CLF", "MUESTRAS", "FOTOFFICE"],
  EMPRESA_TURISMO: ["CLF"],
  NEGOCIO_FOTOGRAFIA: ["CLF", "FOTOFFICE"],
  OTRO: [],
};

/** Las plataformas de DNX que le sirven a cada tipo de contacto (copia: se puede mutar sin riesgo). */
export function plataformasPorTipo(tipo: TipoContacto): Plataforma[] {
  return [...PLATAFORMAS_POR_TIPO[tipo]];
}
