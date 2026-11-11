/**
 * Constantes de la base Contactos DNX y del agente Buscador. Los conjuntos viven en TEXT con CHECK en
 * la base (como el resto de FOTOFFICE), así que esta es la única lista en el código.
 */

export const TIPOS_CONTACTO = [
  "FOTOGRAFO", "ESCUELA", "CLUB", "ORGANIZADOR_EVENTOS", "ASOCIACION_FOTOGRAFOS",
  "ORGANIZADOR_MUESTRAS", "EMPRESA_TURISMO", "NEGOCIO_FOTOGRAFIA", "ESCUELA_FOTOGRAFIA", "OTRO",
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
  ESCUELA_FOTOGRAFIA: ["CLF", "FOTOFFICE"],
  OTRO: [],
};

/** Las plataformas de DNX que le sirven a cada tipo de contacto (copia: se puede mutar sin riesgo). */
export function plataformasPorTipo(tipo: TipoContacto): Plataforma[] {
  return [...PLATAFORMAS_POR_TIPO[tipo]];
}

/**
 * Evento de `DnxContactoEvento` que deja el paso «completar correos» del Buscador por cada intento de
 * conseguirle el correo a un contacto que ya estaba sin email. En `datos` van el resultado y el costo
 * de Claude (`costoClaudeUsdMicros`), que `gastoDelMes` suma al gasto del Buscador.
 */
export const EVENTO_BUSQUEDA_CORREO = "BUSQUEDA_CORREO";

/**
 * Cómo terminó un intento. `REINTENTAR` (Claude caído, sin tiempo, llamada cortada) no cuenta como
 * intento hecho: el contacto se vuelve a probar en otra corrida (ver `correos.ts`). `EN_CURSO` es un
 * intento que quedó a medias porque la corrida murió: cuenta como hecho (no se repite sin fin).
 */
export const RESULTADOS_BUSQUEDA_CORREO = [
  "EN_CURSO", "COMPLETADO", "SIN_CORREO", "DUPLICADO", "YA_TENIA", "ERROR", "REINTENTAR",
] as const;
export type ResultadoBusquedaCorreo = (typeof RESULTADOS_BUSQUEDA_CORREO)[number];
