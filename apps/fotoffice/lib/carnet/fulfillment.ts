/**
 * El recorrido de un carnet físico, desde que se pide hasta que llega a las manos del socio.
 *
 * A diferencia de `habilitado`, que se calcula, **esto se guarda**: cada paso lo causó una
 * persona —el impresor imprimió, la Secretaría entregó— y por lo tanto es un hecho con
 * fecha y responsable. Es la misma regla que ordena todo el dominio: las decisiones se
 * guardan, las derivaciones se calculan.
 */

export const FULFILLMENT_STATES = [
  /** Se pidió la tarjeta y todavía no se pagó. */
  "PENDIENTE_PAGO",
  /** Pagada y esperando que alguien la mande a imprimir. */
  "EN_COLA",
  /** El impresor la marcó como impresa. */
  "IMPRESO",
  /** Está en la sede, el socio puede pasar a buscarla. */
  "LISTO_PARA_RETIRAR",
  /** Despachada por correo. */
  "ENVIADO",
  /** En manos del socio. */
  "ENTREGADO",
  /** Se dio de baja el pedido: se canceló, se perdió, salió mal. */
  "ANULADO",
] as const;

export type FulfillmentState = (typeof FULFILLMENT_STATES)[number];

/**
 * Qué se puede hacer desde cada estado.
 *
 * No se puede entregar algo que no se imprimió. Saltearse pasos rompería justamente lo que
 * este registro viene a dar: saber en qué punto está cada carnet y quién lo movió.
 */
const TRANSICIONES: Record<FulfillmentState, readonly FulfillmentState[]> = {
  PENDIENTE_PAGO: ["EN_COLA", "ANULADO"],
  EN_COLA: ["IMPRESO", "ANULADO"],
  IMPRESO: ["LISTO_PARA_RETIRAR", "ENVIADO", "ANULADO"],
  // Se puede despachar por correo algo que estaba para retirar: el socio no vino y se le manda.
  LISTO_PARA_RETIRAR: ["ENTREGADO", "ENVIADO", "ANULADO"],
  // Confirmar la recepción de un envío es opcional, pero si se confirma queda registrado.
  ENVIADO: ["ENTREGADO", "ANULADO"],
  // Entregado es el final del camino. Si hay que rehacerlo, se anula y se emite otro carnet:
  // un carnet que vuelve para atrás dejaría de contar lo que realmente pasó.
  ENTREGADO: ["ANULADO"],
  ANULADO: [],
};

export function allowedTransitions(from: FulfillmentState): readonly FulfillmentState[] {
  return TRANSICIONES[from];
}

export function canTransition(from: FulfillmentState, to: FulfillmentState): boolean {
  return TRANSICIONES[from].includes(to);
}

export function isTerminal(state: FulfillmentState): boolean {
  return TRANSICIONES[state].length === 0;
}

/** Qué permiso hace falta para cada paso. */
export type FulfillmentCapability = "PRODUCIR" | "ENTREGAR" | "ADMINISTRAR";

export function capabilityFor(to: FulfillmentState): FulfillmentCapability {
  switch (to) {
    case "EN_COLA":
    case "IMPRESO":
      return "PRODUCIR";
    case "LISTO_PARA_RETIRAR":
    case "ENVIADO":
    case "ENTREGADO":
      return "ENTREGAR";
    case "ANULADO":
      // Anular es deshacer un pedido pago: no lo puede hacer quien solo imprime.
      return "ADMINISTRAR";
    default:
      return "ADMINISTRAR";
  }
}

export type TransitionRequest = {
  from: FulfillmentState;
  to: FulfillmentState;
  capabilities: readonly FulfillmentCapability[];
  /** Obligatoria para anular y para despachar. */
  note?: string | null;
};

export type TransitionCheck =
  | { ok: true }
  | { ok: false; code: "NOT_ALLOWED" | "NO_PERMISSION" | "NOTE_REQUIRED"; message: string };

const ETIQUETA: Record<FulfillmentState, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  EN_COLA: "En cola de impresión",
  IMPRESO: "Impreso",
  LISTO_PARA_RETIRAR: "Listo para retirar",
  ENVIADO: "Enviado por correo",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
};

export function stateLabel(state: FulfillmentState): string {
  return ETIQUETA[state];
}

export function checkTransition(request: TransitionRequest): TransitionCheck {
  if (!canTransition(request.from, request.to)) {
    return {
      ok: false,
      code: "NOT_ALLOWED",
      message: `Un carnet ${ETIQUETA[request.from].toLowerCase()} no puede pasar a ${ETIQUETA[request.to].toLowerCase()}.`,
    };
  }

  const necesaria = capabilityFor(request.to);
  if (!request.capabilities.includes(necesaria)) {
    return {
      ok: false,
      code: "NO_PERMISSION",
      message: "No tenés permiso para hacer este cambio en los carnets.",
    };
  }

  // Anular y despachar piden explicación: son los dos pasos que después alguien va a
  // preguntar por qué se hicieron.
  const pideNota = request.to === "ANULADO" || request.to === "ENVIADO";
  if (pideNota && !request.note?.trim()) {
    return {
      ok: false,
      code: "NOTE_REQUIRED",
      message:
        request.to === "ANULADO"
          ? "Escribí por qué se anula el carnet."
          : "Anotá cómo se despachó: correo, número de seguimiento o quién lo llevó.",
    };
  }

  return { ok: true };
}

/** Estados en los que tiene sentido avisarle al socio. */
export function shouldNotifyMember(to: FulfillmentState): boolean {
  return to === "LISTO_PARA_RETIRAR" || to === "ENVIADO" || to === "ENTREGADO";
}
