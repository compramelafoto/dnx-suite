/**
 * Los estados del módulo.
 *
 * Cada entidad tiene su propio conjunto, y no uno solo para todo, porque de otro modo habría
 * que inventar combinaciones imposibles —"aprobada pero entrega observada"— y habría que
 * mirar una solicitud para saber si una persona confirmó que va.
 *
 * Son cadenas y no enums de Prisma: el esquema lo comparten cinco aplicaciones, y agregar un
 * valor a un enum compartido es una migración en cinco bases.
 */

export const REQUEST_STATUSES = [
  "RECIBIDA",
  "EN_EVALUACION",
  "REQUIERE_INFO",
  "APROBADA",
  "RECHAZADA",
  "CANCELADA_SOLICITANTE",
  "CANCELADA_ORGANIZACION",
  "CERRADA",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}

/**
 * Cómo se lee cada estado en pantalla.
 *
 * "Cancelada por ustedes" y no "cancelada por el solicitante": quien lee esto en el enlace de
 * seguimiento es la organización, y hablarle en tercera persona sobre sí misma es raro.
 */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  RECIBIDA: "Recibida",
  EN_EVALUACION: "En evaluación",
  REQUIERE_INFO: "Necesitamos más información",
  APROBADA: "Aprobada",
  RECHAZADA: "No pudimos tomarla",
  CANCELADA_SOLICITANTE: "Cancelada por la organización solicitante",
  CANCELADA_ORGANIZACION: "Cancelada",
  CERRADA: "Cerrada",
};

export function requestStatusLabel(status: string): string {
  return isRequestStatus(status) ? REQUEST_STATUS_LABELS[status] : status;
}

/** Estados en los que la solicitud todavía está viva y puede cancelarse. */
export const REQUEST_LIVE_STATUSES: readonly RequestStatus[] = [
  "RECIBIDA",
  "EN_EVALUACION",
  "REQUIERE_INFO",
  "APROBADA",
];

/**
 * Cómo se lee cada tipo de evento del historial.
 *
 * Los valores repiten a mano los de `CoverageEventType` (ver `lib/coverages/events.ts`) en vez
 * de importar ese tipo: `events.ts` es `server-only` y este archivo lo leen también componentes
 * de cliente, así que importar de ahí arrastraría ese límite hasta acá sin necesidad.
 *
 * La ficha de una solicitud es lo único que la organización nunca ve —el historial es interno—
 * pero igual se lee en español: quien coordina y revisa tampoco tiene por qué conocer los
 * nombres internos de cada tipo de evento.
 */
export const COVERAGE_EVENT_LABELS: Record<string, string> = {
  CREADA: "Solicitud creada",
  ESTADO_CAMBIADO: "Cambio de estado",
  NOTA: "Nota interna",
  INFO_PEDIDA: "Se pidió información",
  INFO_RESPONDIDA: "Respondieron",
  EMAIL_ENVIADO: "Correo enviado",
};

export function coverageEventLabel(type: string): string {
  return COVERAGE_EVENT_LABELS[type] ?? type;
}
