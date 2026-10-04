import {
  APPLICATION_LIVE_STATUSES,
  ASSIGNMENT_LIVE_STATUSES,
  CALL_LIVE_STATUSES,
  COVERAGE_LIVE_STATUSES,
  REQUEST_LIVE_STATUSES,
  applicationStatusLabel,
  assignmentStatusLabel,
  callStatusLabel,
  coverageStatusLabel,
  isApplicationStatus,
  isAssignmentStatus,
  isCallStatus,
  isCoverageStatus,
  isRequestStatus,
  requestStatusLabel,
  type ApplicationStatus,
  type AssignmentStatus,
  type CallStatus,
  type CoverageStatus,
  type RequestStatus,
} from "./states";

/**
 * Qué transición de solicitud es válida.
 *
 * Tabla explícita en vez de reglas sueltas repartidas por las pantallas: acá se lee de un
 * vistazo qué puede pasar después de qué, y agregar un camino obliga a tocar este archivo y
 * su test.
 *
 * Quedarse en el mismo estado NO es una transición: si una pantalla la intenta, es que hay un
 * doble clic o un formulario reenviado, y dejarla pasar duplicaría el evento del historial.
 */
const TRANSICIONES: Record<RequestStatus, readonly RequestStatus[]> = {
  RECIBIDA: ["EN_EVALUACION"],
  EN_EVALUACION: ["REQUIERE_INFO", "APROBADA", "RECHAZADA"],
  REQUIERE_INFO: ["EN_EVALUACION", "RECHAZADA"],
  APROBADA: ["CERRADA"],
  // Terminales: un rechazo que se reabre deja el historial contando una historia falsa. Si la
  // organización insiste con datos nuevos, es una solicitud nueva.
  RECHAZADA: [],
  CANCELADA_SOLICITANTE: [],
  CANCELADA_ORGANIZACION: [],
  CERRADA: [],
};

/** Cancelar se puede desde cualquier estado vivo, sin listarlo en cada fila de la tabla. */
const CANCELACIONES: readonly RequestStatus[] = [
  "CANCELADA_SOLICITANTE",
  "CANCELADA_ORGANIZACION",
];

export function canTransitionRequest(from: string, to: string): boolean {
  if (!isRequestStatus(from) || !isRequestStatus(to)) return false;
  if (from === to) return false;
  if (CANCELACIONES.includes(to)) return REQUEST_LIVE_STATUSES.includes(from);
  return TRANSICIONES[from].includes(to);
}

/**
 * Qué transiciones exigen que alguien escriba por qué.
 *
 * Las tres que le cierran la puerta a la organización. Sin motivo, el correo que recibe dice
 * "no pudimos tomarla" y nada más, y la persona que lo lee no tiene a dónde ir con eso.
 */
export function transitionRequiresReason(to: string): boolean {
  return to === "RECHAZADA" || CANCELACIONES.includes(to as RequestStatus);
}

export type TransitionCheck = { ok: true } | { ok: false; error: string };

export function assertRequestTransition(input: {
  from: string;
  to: string;
  reason?: string | null;
}): TransitionCheck {
  if (!canTransitionRequest(input.from, input.to)) {
    return {
      ok: false,
      error: `No se puede pasar de «${requestStatusLabel(input.from)}» a «${requestStatusLabel(input.to)}».`,
    };
  }
  if (transitionRequiresReason(input.to) && !input.reason?.trim()) {
    return { ok: false, error: "Escribí el motivo: se le comunica a la organización." };
  }
  return { ok: true };
}

/**
 * Qué transición de cobertura es válida.
 *
 * `SIN_EQUIPO` sale de `BUSCANDO_EQUIPO` cuando la convocatoria vence sin completar los roles.
 * No es terminal: `SIN_EQUIPO` vuelve a `BUSCANDO_EQUIPO` porque una cobertura que se quedó sin
 * gente y todavía tiene fecha por delante se puede volver a intentar — cerrarle la puerta
 * obligaría a crear una cobertura nueva y perder el historial de la que ya existe. Ese reintento
 * es sobre esta misma cobertura, aunque haga falta una convocatoria nueva para volver a buscar
 * (la convocatoria sí es 1:1 y ya quedó vencida).
 *
 * `EQUIPO_CONFIRMADO` vuelve a `BUSCANDO_EQUIPO` cuando alguien ya asignado rechaza: sin ese
 * camino de vuelta, un rechazo deja la cobertura con estado "equipo confirmado" mintiendo sobre
 * un equipo que ya no está completo.
 */
const TRANSICIONES_COBERTURA: Record<CoverageStatus, readonly CoverageStatus[]> = {
  PLANIFICADA: ["BUSCANDO_EQUIPO"],
  BUSCANDO_EQUIPO: ["EQUIPO_CONFIRMADO", "SIN_EQUIPO"],
  EQUIPO_CONFIRMADO: ["BUSCANDO_EQUIPO", "REALIZADA"],
  REALIZADA: ["ENTREGADA"],
  ENTREGADA: ["CERRADA"],
  SIN_EQUIPO: ["BUSCANDO_EQUIPO"],
  // Terminales.
  CERRADA: [],
  CANCELADA: [],
};

export function canTransitionCoverage(from: string, to: string): boolean {
  if (!isCoverageStatus(from) || !isCoverageStatus(to)) return false;
  if (from === to) return false;
  if (to === "CANCELADA") return COVERAGE_LIVE_STATUSES.includes(from);
  return TRANSICIONES_COBERTURA[from].includes(to);
}

/** Cancelar una cobertura exige motivo: es la actividad solidaria completa la que se cae. */
export function coverageTransitionRequiresReason(to: string): boolean {
  return to === "CANCELADA";
}

export function assertCoverageTransition(input: {
  from: string;
  to: string;
  reason?: string | null;
}): TransitionCheck {
  if (!canTransitionCoverage(input.from, input.to)) {
    return {
      ok: false,
      error: `No se puede pasar de «${coverageStatusLabel(input.from)}» a «${coverageStatusLabel(input.to)}».`,
    };
  }
  if (coverageTransitionRequiresReason(input.to) && !input.reason?.trim()) {
    return { ok: false, error: "Escribí el motivo: queda en el historial de la cobertura." };
  }
  return { ok: true };
}

/**
 * Qué transición de convocatoria es válida.
 *
 * `COMPLETA` vuelve a `PUBLICADA` cuando alguien ya seleccionado rechaza la asignación: el rol
 * vuelve a tener una vacante libre y la convocatoria tiene que volver a mostrarse como abierta,
 * o nadie se entera de que hace falta cubrir ese lugar de nuevo.
 */
const TRANSICIONES_CONVOCATORIA: Record<CallStatus, readonly CallStatus[]> = {
  BORRADOR: ["PUBLICADA"],
  PUBLICADA: ["COMPLETA", "VENCIDA"],
  COMPLETA: ["PUBLICADA", "CERRADA"],
  // Terminales.
  CERRADA: [],
  VENCIDA: [],
  CANCELADA: [],
};

export function canTransitionCall(from: string, to: string): boolean {
  if (!isCallStatus(from) || !isCallStatus(to)) return false;
  if (from === to) return false;
  if (to === "CANCELADA") return CALL_LIVE_STATUSES.includes(from);
  return TRANSICIONES_CONVOCATORIA[from].includes(to);
}

/** Cancelar una convocatoria exige motivo: deja de buscarse gente y hay que poder explicar por qué. */
export function callTransitionRequiresReason(to: string): boolean {
  return to === "CANCELADA";
}

export function assertCallTransition(input: {
  from: string;
  to: string;
  reason?: string | null;
}): TransitionCheck {
  if (!canTransitionCall(input.from, input.to)) {
    return {
      ok: false,
      error: `No se puede pasar de «${callStatusLabel(input.from)}» a «${callStatusLabel(input.to)}».`,
    };
  }
  if (callTransitionRequiresReason(input.to) && !input.reason?.trim()) {
    return { ok: false, error: "Escribí el motivo: queda en el historial de la convocatoria." };
  }
  return { ok: true };
}

/**
 * Qué transición de postulación es válida.
 *
 * `EN_REVISION` y `PRESELECCIONADA` son pasos opcionales de revisión, no obligatorios: el
 * coordinador puede seleccionar directamente desde `RECIBIDA` si el volumen de postulaciones no
 * amerita una revisión formal. Por eso `SELECCIONADA`, `NO_SELECCIONADA`, `RETIRADA` y
 * `VENCIDA` —las cuatro resoluciones posibles— se alcanzan desde cualquier estado vivo, en vez
 * de listarlas una por una en cada fila.
 *
 * Ninguna transición de postulación exige motivo: rechazar a alguien de un voluntariado
 * ("en esta oportunidad el equipo ya está completo") no es un reproche que haya que justificar
 * por escrito, y retirarse es una decisión de la propia persona.
 *
 * `SELECCIONADA → RETIRADA` es la única salida de `SELECCIONADA`, y existe por un caso concreto:
 * a quien fue seleccionada le nace una asignación `INVITADA`, y si contesta «esta vez no puedo»
 * su asignación queda `RECHAZADA` pero su postulación se quedaba en `SELECCIONADA` para siempre.
 * En «Tus postulaciones» leía "Seleccionada", que es lo contrario de lo que hizo, y el cierre
 * automático del final no la alcanzaba porque `SELECCIONADA` no es un estado vivo. `RETIRADA` es
 * la palabra exacta: la decisión fue de ella.
 */
const TRANSICIONES_POSTULACION: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  RECIBIDA: ["EN_REVISION"],
  EN_REVISION: ["PRESELECCIONADA"],
  SELECCIONADA: ["RETIRADA"],
  // Terminales (más allá de las resoluciones, que se resuelven aparte).
  PRESELECCIONADA: [],
  NO_SELECCIONADA: [],
  RETIRADA: [],
  VENCIDA: [],
};

/** Las cuatro salidas posibles desde cualquier estado vivo de la postulación. */
const RESOLUCIONES_POSTULACION: readonly ApplicationStatus[] = [
  "SELECCIONADA",
  "NO_SELECCIONADA",
  "RETIRADA",
  "VENCIDA",
];

export function canTransitionApplication(from: string, to: string): boolean {
  if (!isApplicationStatus(from) || !isApplicationStatus(to)) return false;
  if (from === to) return false;
  // Las resoluciones se alcanzan desde cualquier estado vivo, y ADEMÁS desde donde la tabla lo
  // diga: `SELECCIONADA` no es un estado vivo y sin embargo tiene su salida a `RETIRADA`. Sin
  // este segundo camino, el atajo de las resoluciones se comía la única fila de la tabla que dice
  // algo sobre `SELECCIONADA`.
  if (RESOLUCIONES_POSTULACION.includes(to)) {
    return APPLICATION_LIVE_STATUSES.includes(from) || TRANSICIONES_POSTULACION[from].includes(to);
  }
  return TRANSICIONES_POSTULACION[from].includes(to);
}

export function assertApplicationTransition(input: {
  from: string;
  to: string;
  reason?: string | null;
}): TransitionCheck {
  if (!canTransitionApplication(input.from, input.to)) {
    return {
      ok: false,
      error: `No se puede pasar de «${applicationStatusLabel(input.from)}» a «${applicationStatusLabel(input.to)}».`,
    };
  }
  return { ok: true };
}

/**
 * Qué transición de asignación es válida.
 *
 * `INVITADA` admite pasar directo a `CONFIRMADA` además de por `ACEPTADA`: en esta etapa la
 * persona invitada responde una sola vez ("confirmo" o "no puedo"), sin un paso separado de
 * aceptar y otro de confirmar. `ACEPTADA` queda disponible para cuando la modalidad del
 * workspace sí distinga ambos pasos, sin tener que volver a tocar este archivo.
 *
 * `CANCELADA` y `REEMPLAZADA` se alcanzan desde cualquier estado vivo: un coordinador puede
 * necesitar dar de baja o reemplazar a alguien en cualquier momento antes de que la cobertura
 * ocurra. `AUSENTE` en cambio solo tiene sentido después de confirmar: si nunca confirmó, no
 * "faltó", directamente no estaba.
 */
const TRANSICIONES_ASIGNACION: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  PROPUESTA: ["INVITADA"],
  INVITADA: ["ACEPTADA", "CONFIRMADA", "RECHAZADA"],
  ACEPTADA: ["CONFIRMADA", "RECHAZADA"],
  CONFIRMADA: ["CUMPLIDA", "AUSENTE"],
  // Terminales (más allá de las resoluciones, que se resuelven aparte).
  CUMPLIDA: [],
  RECHAZADA: [],
  CANCELADA: [],
  REEMPLAZADA: [],
  AUSENTE: [],
};

/** Las dos salidas que un coordinador puede aplicar desde cualquier estado vivo. */
const RESOLUCIONES_ASIGNACION: readonly AssignmentStatus[] = ["CANCELADA", "REEMPLAZADA"];

export function canTransitionAssignment(from: string, to: string): boolean {
  if (!isAssignmentStatus(from) || !isAssignmentStatus(to)) return false;
  if (from === to) return false;
  if (RESOLUCIONES_ASIGNACION.includes(to)) return ASSIGNMENT_LIVE_STATUSES.includes(from);
  return TRANSICIONES_ASIGNACION[from].includes(to);
}

/** Cancelar una asignación y marcar ausente exigen motivo; el resto, no. */
export function assignmentTransitionRequiresReason(to: string): boolean {
  return to === "CANCELADA" || to === "AUSENTE";
}

export function assertAssignmentTransition(input: {
  from: string;
  to: string;
  reason?: string | null;
}): TransitionCheck {
  if (!canTransitionAssignment(input.from, input.to)) {
    return {
      ok: false,
      error: `No se puede pasar de «${assignmentStatusLabel(input.from)}» a «${assignmentStatusLabel(input.to)}».`,
    };
  }
  if (assignmentTransitionRequiresReason(input.to) && !input.reason?.trim()) {
    return { ok: false, error: "Escribí el motivo: queda en el historial de la asignación." };
  }
  return { ok: true };
}
