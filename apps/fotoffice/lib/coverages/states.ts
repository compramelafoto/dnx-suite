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

/**
 * La cobertura: el trabajo concreto que sale de una solicitud aprobada.
 *
 * `SIN_EQUIPO` no es un error: es lo que queda cuando la convocatoria vence sin completar los
 * roles. La cobertura sigue existiendo —la actividad solidaria ya se comprometió— pero sin
 * gente asignada. No vuelve sola a `BUSCANDO_EQUIPO` —la convocatoria es 1:1 con la cobertura y
 * ya está vencida, así que retomar la búsqueda es una decisión de alguien, no automática— pero
 * sí puede volver de forma manual: si todavía queda fecha por delante tiene sentido reintentar
 * sobre esta misma cobertura en vez de perder su historial creando una nueva (ver la transición
 * en `transitions.ts`).
 */
export const COVERAGE_STATUSES = [
  "PLANIFICADA",
  "BUSCANDO_EQUIPO",
  "EQUIPO_CONFIRMADO",
  "REALIZADA",
  "ENTREGADA",
  "CERRADA",
  "SIN_EQUIPO",
  "CANCELADA",
] as const;

export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export function isCoverageStatus(value: unknown): value is CoverageStatus {
  return typeof value === "string" && (COVERAGE_STATUSES as readonly string[]).includes(value);
}

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  PLANIFICADA: "Planificada",
  BUSCANDO_EQUIPO: "Buscando equipo",
  EQUIPO_CONFIRMADO: "Equipo confirmado",
  REALIZADA: "Realizada",
  ENTREGADA: "Entregada",
  CERRADA: "Cerrada",
  SIN_EQUIPO: "Sin equipo",
  CANCELADA: "Cancelada",
};

export function coverageStatusLabel(status: string): string {
  return isCoverageStatus(status) ? COVERAGE_STATUS_LABELS[status] : status;
}

/** Estados en los que la cobertura todavía está viva y puede cancelarse. */
export const COVERAGE_LIVE_STATUSES: readonly CoverageStatus[] = [
  "PLANIFICADA",
  "BUSCANDO_EQUIPO",
  "EQUIPO_CONFIRMADO",
];

/**
 * La convocatoria: la publicación de una cobertura para que la gente se postule. 1:1 con la
 * cobertura, así que no hay "volver a publicar" después de `VENCIDA` o `CERRADA`: si hace
 * falta buscar de nuevo, es sobre una cobertura nueva.
 */
export const CALL_STATUSES = [
  "BORRADOR",
  "PUBLICADA",
  "COMPLETA",
  "CERRADA",
  "VENCIDA",
  "CANCELADA",
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export function isCallStatus(value: unknown): value is CallStatus {
  return typeof value === "string" && (CALL_STATUSES as readonly string[]).includes(value);
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  COMPLETA: "Completa",
  CERRADA: "Cerrada",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

export function callStatusLabel(status: string): string {
  return isCallStatus(status) ? CALL_STATUS_LABELS[status] : status;
}

/** Estados en los que la convocatoria todavía está viva y puede cancelarse. */
export const CALL_LIVE_STATUSES: readonly CallStatus[] = ["BORRADOR", "PUBLICADA", "COMPLETA"];

/**
 * La postulación: alguien se ofrece para un rol. No para la cobertura entera — ver el
 * vocabulario de la etapa en el plan.
 */
export const APPLICATION_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "PRESELECCIONADA",
  "SELECCIONADA",
  "NO_SELECCIONADA",
  "RETIRADA",
  "VENCIDA",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  RECIBIDA: "Recibida",
  EN_REVISION: "En revisión",
  PRESELECCIONADA: "Preseleccionada",
  SELECCIONADA: "Seleccionada",
  NO_SELECCIONADA: "No seleccionada",
  RETIRADA: "Retirada",
  VENCIDA: "Vencida",
};

export function applicationStatusLabel(status: string): string {
  return isApplicationStatus(status) ? APPLICATION_STATUS_LABELS[status] : status;
}

/** Estados en los que la postulación todavía espera una decisión y se puede retirar. */
export const APPLICATION_LIVE_STATUSES: readonly ApplicationStatus[] = [
  "RECIBIDA",
  "EN_REVISION",
  "PRESELECCIONADA",
];

/**
 * La asignación: alguien quedó en un rol, sea porque su postulación fue seleccionada o porque
 * se lo invitó directamente. `CUMPLIDA` y `AUSENTE` pertenecen al registro de participación
 * —etapa 1c, sin pantalla propia todavía— pero se definen ahora para no volver a tocar este
 * archivo cuando llegue esa etapa.
 *
 * `ACEPTADA` y `CONFIRMADA` no son un paso duplicado, aunque en esta etapa se lleguen igual:
 * `ACEPTADA` es que la persona dijo que sí cuando se la invitó; `CONFIRMADA` es la confirmación
 * de asistencia cerca de la fecha ("confirmá que venís el sábado"), junto con la ficha
 * operativa del día — eso es de la etapa 1c. No los unifiquen: son dos momentos distintos del
 * mismo vínculo, no el mismo momento contado dos veces.
 */
export const ASSIGNMENT_STATUSES = [
  "PROPUESTA",
  "INVITADA",
  "ACEPTADA",
  "CONFIRMADA",
  "CUMPLIDA",
  "RECHAZADA",
  "CANCELADA",
  "REEMPLAZADA",
  "AUSENTE",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && (ASSIGNMENT_STATUSES as readonly string[]).includes(value);
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PROPUESTA: "Propuesta",
  INVITADA: "Invitada",
  ACEPTADA: "Aceptada",
  CONFIRMADA: "Confirmada",
  CUMPLIDA: "Cumplida",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  REEMPLAZADA: "Reemplazada",
  AUSENTE: "Ausente",
};

export function assignmentStatusLabel(status: string): string {
  return isAssignmentStatus(status) ? ASSIGNMENT_STATUS_LABELS[status] : status;
}

/** Estados en los que la asignación todavía está viva: se puede cancelar o reemplazar. */
export const ASSIGNMENT_LIVE_STATUSES: readonly AssignmentStatus[] = [
  "PROPUESTA",
  "INVITADA",
  "ACEPTADA",
  "CONFIRMADA",
];
