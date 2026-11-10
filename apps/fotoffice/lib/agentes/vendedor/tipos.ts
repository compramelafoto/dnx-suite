/**
 * Constantes del agente Vendedor (correos a los contactos de la base Contactos DNX). Los conjuntos viven
 * en TEXT con CHECK en la base, así que esta es la única lista en el código.
 */
import { NICHOS, type TipoContacto } from "../buscador/tipos";

export const GRUPOS = [
  ...NICHOS.map((n) => `FOTOGRAFO:${n}` as const),
  "FOTOGRAFO:GENERAL", "ESCUELA", "ESCUELA_FOTOGRAFIA", "CLUB", "ORGANIZADOR_EVENTOS",
  "ASOCIACION_FOTOGRAFOS", "ORGANIZADOR_MUESTRAS", "EMPRESA_TURISMO", "NEGOCIO_FOTOGRAFIA",
] as const;
export type Grupo = (typeof GRUPOS)[number];

const TIPOS_CON_GRUPO_PROPIO: readonly string[] = [
  "ESCUELA", "ESCUELA_FOTOGRAFIA", "CLUB", "ORGANIZADOR_EVENTOS", "ASOCIACION_FOTOGRAFOS",
  "ORGANIZADOR_MUESTRAS", "EMPRESA_TURISMO", "NEGOCIO_FOTOGRAFIA",
] satisfies TipoContacto[];

/** El grupo de mensaje de un contacto; null si no se le escribe (OTRO o un tipo desconocido). */
export function grupoDe(c: { tipo: string; nichos: string[] }): Grupo | null {
  if (c.tipo === "FOTOGRAFO") {
    const nicho = c.nichos[0];
    return nicho && (NICHOS as readonly string[]).includes(nicho)
      ? (`FOTOGRAFO:${nicho}` as Grupo)
      : "FOTOGRAFO:GENERAL";
  }
  return TIPOS_CON_GRUPO_PROPIO.includes(c.tipo) ? (c.tipo as Grupo) : null;
}

export const GRUPOS_CON_LANDING_PROPIA: readonly Grupo[] = ["FOTOGRAFO:ESCOLAR", "ESCUELA", "CLUB", "ORGANIZADOR_EVENTOS"];
export const GRUPOS_DE_CLUBES: readonly Grupo[] = ["CLUB", "ORGANIZADOR_EVENTOS"];
export const GRUPOS_DE_MUESTRAS: readonly Grupo[] = ["ORGANIZADOR_MUESTRAS"];

/** La portada de Muestras Fotográficas: el único enlace fuera de CLF, sólo para organizadores de muestras. */
export const URL_MUESTRAS = "https://muestrasfotograficas.com";

export const LANDINGS_PERMITIDAS = [
  "/land", "/land/fotografo-escolar", "/tutoriales/fotografia-escolar", "/tutoriales/fotografia-de-turismo",
  "/escuelas", "/dnx/escolar", "/organizador", "/clubes", URL_MUESTRAS,
] as const;

export const LANDING_POR_GRUPO: Record<Grupo, string> = {
  "FOTOGRAFO:ESCOLAR": "/land/fotografo-escolar",
  "FOTOGRAFO:DEPORTIVA": "/land",
  "FOTOGRAFO:TURISTICA": "/tutoriales/fotografia-de-turismo",
  "FOTOGRAFO:SOCIAL": "/land",
  "FOTOGRAFO:EVENTOS": "/land",
  "FOTOGRAFO:FOTO_CARNET": "/land",
  "FOTOGRAFO:CORPORATIVA": "/land",
  "FOTOGRAFO:MASCOTAS_NEWBORN_FAMILIA": "/land",
  "FOTOGRAFO:GENERAL": "/land",
  ESCUELA: "/escuelas",
  CLUB: "/clubes",
  ORGANIZADOR_EVENTOS: "/clubes",
  ORGANIZADOR_MUESTRAS: URL_MUESTRAS,
  EMPRESA_TURISMO: "/organizador",
  ASOCIACION_FOTOGRAFOS: "/land",
  NEGOCIO_FOTOGRAFIA: "/land",
  ESCUELA_FOTOGRAFIA: "/land",
};

export const CURSO_POR_GRUPO: Record<Grupo, string> = {
  "FOTOGRAFO:ESCOLAR": "/tutoriales/fotografia-escolar",
  ESCUELA: "/tutoriales/fotografia-escolar",
  "FOTOGRAFO:TURISTICA": "/tutoriales/fotografia-de-turismo",
  EMPRESA_TURISMO: "/tutoriales/fotografia-de-turismo",
  "FOTOGRAFO:DEPORTIVA": "/tutoriales",
  "FOTOGRAFO:SOCIAL": "/tutoriales",
  "FOTOGRAFO:EVENTOS": "/tutoriales",
  "FOTOGRAFO:FOTO_CARNET": "/tutoriales",
  "FOTOGRAFO:CORPORATIVA": "/tutoriales",
  "FOTOGRAFO:MASCOTAS_NEWBORN_FAMILIA": "/tutoriales",
  "FOTOGRAFO:GENERAL": "/tutoriales",
  CLUB: "/tutoriales",
  ORGANIZADOR_EVENTOS: "/tutoriales",
  ORGANIZADOR_MUESTRAS: "/tutoriales",
  ASOCIACION_FOTOGRAFOS: "/tutoriales",
  NEGOCIO_FOTOGRAFIA: "/tutoriales",
  ESCUELA_FOTOGRAFIA: "/tutoriales",
};

export const ROTULO_GRUPO: Record<Grupo, string> = {
  "FOTOGRAFO:ESCOLAR": "Fotógrafos escolares",
  "FOTOGRAFO:DEPORTIVA": "Fotógrafos deportivos",
  "FOTOGRAFO:TURISTICA": "Fotógrafos de turismo",
  "FOTOGRAFO:SOCIAL": "Fotógrafos sociales",
  "FOTOGRAFO:EVENTOS": "Fotógrafos de eventos",
  "FOTOGRAFO:FOTO_CARNET": "Fotógrafos de foto carnet",
  "FOTOGRAFO:CORPORATIVA": "Fotógrafos corporativos",
  "FOTOGRAFO:MASCOTAS_NEWBORN_FAMILIA": "Fotógrafos de mascotas, newborn y familia",
  "FOTOGRAFO:GENERAL": "Fotógrafos (general)",
  ESCUELA: "Escuelas",
  ESCUELA_FOTOGRAFIA: "Escuelas de fotografía",
  CLUB: "Clubes",
  ORGANIZADOR_EVENTOS: "Organizadores de eventos",
  ASOCIACION_FOTOGRAFOS: "Asociaciones de fotógrafos",
  ORGANIZADOR_MUESTRAS: "Organizadores de muestras",
  EMPRESA_TURISMO: "Empresas de turismo",
  NEGOCIO_FOTOGRAFIA: "Negocios de fotografía",
};

/** Grupos cuyas respuestas INTERESADO y CAPACITACION nunca se contestan solas. */
export const GRUPOS_SIEMPRE_A_DANIEL: readonly Grupo[] = ["ESCUELA_FOTOGRAFIA"];

export const ESTADOS_MODELO = ["PROPUESTO", "APROBADO", "DESCARTADO"] as const;
export type EstadoModelo = (typeof ESTADOS_MODELO)[number];

export const ESTADOS_HILO = [
  "PENDIENTE_ENVIO", "ENVIADO", "RECORDADO", "RESPONDIO", "ESPERA_DANIEL", "CERRADO", "BAJA",
] as const;
export type EstadoHilo = (typeof ESTADOS_HILO)[number];

export const CIERRES = [
  "REBOTE", "QUEJA", "NO_INTERESA", "BAJA", "BAJA_CLF", "YA_ERA_USUARIO", "FALLO", "MANUAL",
] as const;
export type Cierre = (typeof CIERRES)[number];

export const PASOS_SALIDA = ["PRIMERO", "RECORDATORIO", "RESPUESTA", "REENVIO"] as const;
export type PasoSalida = (typeof PASOS_SALIDA)[number];

export const CLASES_RESPUESTA = [
  "INTERESADO", "CAPACITACION", "NO_INTERESA", "BAJA", "DELICADA", "AUTOMATICA",
] as const;
export type ClaseRespuesta = (typeof CLASES_RESPUESTA)[number];

export const MOTIVOS_GASTO = ["MODELO", "CORREO", "RECORDATORIO", "CLASIFICACION", "CORRECCION"] as const;
export type MotivoGasto = (typeof MOTIVOS_GASTO)[number];

export const REMITENTE_VENDEDOR = "Daniel Cuart <daniel@compramelafoto.com>";
export const RESPONDER_A = "daniel@compramelafoto.com";
export const CASILLA_DANIEL = "dnxfotografia@gmail.com";
export const URL_CLF = "https://www.compramelafoto.com";
export const PARAM_SEGUIMIENTO = "dnxv";
export const AUTOR_VENDEDOR = "VENDEDOR";
