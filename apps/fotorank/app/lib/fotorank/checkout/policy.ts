/**
 * Política de checkout: cuándo un participante puede iniciar un pago.
 *
 * Decisión pura y del lado servidor. El cliente sólo aporta la cantidad de
 * fotografías; jamás el importe, la etapa de precio ni su elegibilidad.
 *
 * Orden de verificación (falla cerrado, más restrictivo primero):
 *   1. Fase del concurso.
 *   2. Configuración del checkout.
 *   3. Ventana de inscripción.
 *   4. Cantidad solicitada.
 *   5. Inscripción previa.
 */

import { canAcceptPayments } from "../upcoming/lifecycle";

export type CheckoutBlockReason =
  | "CONTEST_NOT_OPEN"
  | "CHECKOUT_NOT_CONFIGURED"
  | "REGISTRATION_WINDOW_CLOSED"
  | "INVALID_QUANTITY"
  | "ALREADY_REGISTERED"
  | "NO_PRICE_AVAILABLE";

export type CheckoutDecision =
  | { allowed: true; quantity: number }
  | { allowed: false; reason: CheckoutBlockReason; message: string };

export type CheckoutPolicyInput = {
  now: Date;
  contestStatus: string;
  /** Resultado de `checkConfigReadiness`. */
  configReady: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  quantity: number;
  maxPhotosPerParticipant: number;
  /** El participante ya tiene una inscripción confirmada o pendiente. */
  existingRegistrationStatus: "NONE" | "PENDING_PAYMENT" | "CONFIRMED";
};

export function decideCheckout(input: CheckoutPolicyInput): CheckoutDecision {
  // 1. La fase manda. `canAcceptPayments` exige REGISTRATION_OPEN y el flag activo.
  if (!canAcceptPayments({ status: input.contestStatus, dnxPaymentsEnabled: input.configReady })) {
    if (!input.configReady) {
      return {
        allowed: false,
        reason: "CHECKOUT_NOT_CONFIGURED",
        message: "El cobro de este concurso todavía no está habilitado.",
      };
    }
    return {
      allowed: false,
      reason: "CONTEST_NOT_OPEN",
      message: "El concurso no tiene las inscripciones abiertas.",
    };
  }

  // 2. Ventana de inscripción. El instante exacto de cierre sigue vigente.
  const t = input.now.getTime();
  if (input.registrationOpensAt && t < input.registrationOpensAt.getTime()) {
    return {
      allowed: false,
      reason: "REGISTRATION_WINDOW_CLOSED",
      message: "Las inscripciones todavía no abrieron.",
    };
  }
  if (input.registrationClosesAt && t > input.registrationClosesAt.getTime()) {
    return {
      allowed: false,
      reason: "REGISTRATION_WINDOW_CLOSED",
      message: "Las inscripciones ya cerraron.",
    };
  }

  // 3. Cantidad de fotografías.
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > input.maxPhotosPerParticipant
  ) {
    return {
      allowed: false,
      reason: "INVALID_QUANTITY",
      message: `Podés elegir entre 1 y ${input.maxPhotosPerParticipant} fotografías.`,
    };
  }

  // 4. Una inscripción por persona.
  if (input.existingRegistrationStatus === "CONFIRMED") {
    return {
      allowed: false,
      reason: "ALREADY_REGISTERED",
      message: "Ya estás inscripto en este concurso.",
    };
  }

  return { allowed: true, quantity: input.quantity };
}

/**
 * Una inscripción pendiente de pago no bloquea reintentar: el participante
 * puede haber abandonado el checkout. Se reutiliza la misma inscripción.
 */
export function shouldReusePendingRegistration(
  status: CheckoutPolicyInput["existingRegistrationStatus"],
): boolean {
  return status === "PENDING_PAYMENT";
}
