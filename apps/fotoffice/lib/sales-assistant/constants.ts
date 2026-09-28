/**
 * Constantes del Asistente de ventas.
 *
 * Ver docs/superpowers/specs/2026-09-28-asistente-de-ventas-design.md
 */
export const SALES_ASSISTANT_MODULE_KEY = "sales-assistant";
export const ALBOOM_INTEGRATION_KEY = "alboom-crm";
export const ALBOOM_PROVIDER = "ALBOOM";

export const SALES_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const ACCIONES = [
  "ESCRIBIR",
  "PEDIR_SENA",
  "COORDINAR_ENTREVISTA",
  "ESPERAR",
  "CERRAR_PERDIDA",
  "REVISAR_A_MANO",
] as const;
export type AccionVenta = (typeof ACCIONES)[number];

export const ETIQUETA_ACCION: Record<AccionVenta, string> = {
  ESCRIBIR: "Escribir",
  PEDIR_SENA: "Pedir seña",
  COORDINAR_ENTREVISTA: "Coordinar entrevista",
  ESPERAR: "Esperar",
  CERRAR_PERDIDA: "Cerrar como perdida",
  REVISAR_A_MANO: "Revisar a mano",
};

/** Acciones que llevan un mensaje para mandar hoy. */
export const ACCIONES_CON_MENSAJE: readonly AccionVenta[] = [
  "ESCRIBIR",
  "PEDIR_SENA",
  "COORDINAR_ENTREVISTA",
];

export const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"] as const;
export type PrioridadVenta = (typeof PRIORIDADES)[number];

export type EstadoSugerencia =
  | "PENDIENTE"
  | "ENVIADA"
  | "POSPUESTA"
  | "DESCARTADA"
  | "REEMPLAZADA";

export const RESULTADOS = [
  "NO_CONTESTO",
  "INTERESADO",
  "PIDIO_DESCUENTO",
  "LO_PIENSA",
  "NO_VA",
] as const;
export type ResultadoSeguimiento = (typeof RESULTADOS)[number];

export const ETIQUETA_RESULTADO: Record<ResultadoSeguimiento, string> = {
  NO_CONTESTO: "No contestó",
  INTERESADO: "Le interesa",
  PIDIO_DESCUENTO: "Pidió descuento",
  LO_PIENSA: "Lo está pensando",
  NO_VA: "No va",
};

export type TipoSeguimiento = "MENSAJE_ENVIADO" | "RESULTADO" | "NOTA";

export type EstadoSync = "OK" | "ERROR_LOGIN" | "ERROR_ALBOOM" | "PARCIAL";

/** Cuando el evento cruza uno de estos umbrales (días que faltan), se vuelve a analizar. */
export const UMBRALES_EVENTO_DIAS = [60, 30, 14] as const;

export const DEFAULT_WAIT_DAYS = 3;
export const DEFAULT_STALE_DAYS = 120;

/** Análisis simultáneos contra Claude. */
export const ANALISIS_EN_PARALELO = 4;
/** Techo por corrida: la función de Vercel dura 300 s. Lo que sobra queda para la próxima. */
export const MAX_ANALISIS_POR_CORRIDA = 40;
/** "Actualizar ahora" no puede correr más de una vez cada tanto por workspace. */
export const MIN_MINUTOS_ENTRE_CORRIDAS = 10;
