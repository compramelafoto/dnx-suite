/**
 * Qué hacer con un aviso de MercadoPago.
 *
 * Se separa del acceso a la base a propósito: los casos que importan —el aviso repetido, el
 * efectivo que se acredita días después, el contracargo— son difíciles de reproducir contra
 * una base y fáciles de razonar acá.
 */

/** Estados que informa MercadoPago para un pago. */
export type ProviderPaymentStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "in_mediation"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type PaymentOutcome =
  /** Se imputa a los cargos y el socio queda al día por esa parte. */
  | "ACREDITAR"
  /** Todavía no hay plata. **Congela** el plazo, no lo consume. */
  | "ESPERAR"
  /** No hubo pago. Los cargos quedan como estaban. */
  | "RECHAZAR"
  /** Había plata y se fue. Las cuotas vuelven a impagas, sin expulsar a nadie. */
  | "REVERTIR";

export function outcomeForProviderStatus(status: string): PaymentOutcome {
  switch (status) {
    case "approved":
      return "ACREDITAR";
    case "pending":
    case "in_process":
    case "in_mediation":
    case "authorized":
      // `authorized` es una tarjeta con el importe reservado pero no capturado: hay promesa,
      // no hay dinero. Acreditarla dejaría al socio al día con plata que puede no llegar.
      return "ESPERAR";
    case "refunded":
    case "charged_back":
      return "REVERTIR";
    case "rejected":
    case "cancelled":
      return "RECHAZAR";
    default:
      // Un estado que no conocemos no se acredita nunca. Esperar es reversible; acreditar de
      // más, no.
      return "ESPERAR";
  }
}

export type StoredPaymentStatus = "PENDIENTE" | "ACREDITADO" | "RECHAZADO";

/**
 * Si este aviso hay que aplicarlo o ya está aplicado.
 *
 * MercadoPago manda el mismo aviso varias veces, y a veces desordenado. La regla: **un pago
 * ya acreditado no se vuelve a acreditar**, pero sí puede revertirse.
 */
export function shouldApply(input: {
  current: StoredPaymentStatus;
  outcome: PaymentOutcome;
}): boolean {
  if (input.outcome === "ACREDITAR") return input.current !== "ACREDITADO";
  if (input.outcome === "REVERTIR") return input.current === "ACREDITADO";
  if (input.outcome === "RECHAZAR") return input.current === "PENDIENTE";
  return false;
}
