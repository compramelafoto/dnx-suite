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
