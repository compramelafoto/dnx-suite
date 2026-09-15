import {
  REQUEST_LIVE_STATUSES,
  isRequestStatus,
  requestStatusLabel,
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
