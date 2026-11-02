/**
 * Quién puede pasar por la puerta. Copiado de Clickatón (`lib/accreditation/eligibility.ts`) y
 * llevado a los estados de un inscripto de FOTOFFICE: no hay inscripciones "sin confirmar" ni
 * credenciales que se revoquen; el pago es PAGADO, CORTESIA, PENDIENTE o ANULADO.
 *
 * Mismo semáforo: verde se acredita, azul ya estaba, amarillo hay que mirar algo, rojo no pasa.
 */

export type ScanTone = "GREEN" | "YELLOW" | "RED" | "BLUE";

export type EligibilitySnapshot = {
  estadoPago: string;
  alreadyCheckedIn: boolean;
  accreditationEnabled: boolean;
  /** Pago pendiente autorizado en la puerta ("cobro en la entrada"). */
  grantException: boolean;
};

export function isPaidForAccreditation(estadoPago: string): boolean {
  return estadoPago === "PAGADO" || estadoPago === "CORTESIA";
}

export function evaluateAccreditationEligibility(input: EligibilitySnapshot): {
  ok: boolean;
  tone: ScanTone;
  reason: string;
  canCheckIn: boolean;
} {
  if (input.estadoPago === "ANULADO") {
    return { ok: false, tone: "RED", reason: "REGISTRATION_INACTIVE", canCheckIn: false };
  }
  if (input.alreadyCheckedIn) {
    return { ok: true, tone: "BLUE", reason: "ALREADY_CHECKED_IN", canCheckIn: false };
  }
  if (!input.accreditationEnabled) {
    return { ok: false, tone: "YELLOW", reason: "ACCREDITATION_DISABLED", canCheckIn: false };
  }
  if (!isPaidForAccreditation(input.estadoPago)) {
    return { ok: false, tone: "YELLOW", reason: "PAYMENT_PENDING", canCheckIn: input.grantException };
  }
  return { ok: true, tone: "GREEN", reason: "READY", canCheckIn: true };
}

/** El motivo, en palabras. Copiado de `presentAccreditationEligibilityReason` de Clickatón. */
export function presentAccreditationEligibilityReason(reason: string | null | undefined): {
  label: string;
  description: string;
} {
  switch (reason) {
    case "READY":
      return { label: "Lista para acreditar", description: "La persona puede entrar." };
    case "PAYMENT_PENDING":
      return { label: "Pago pendiente", description: "El pago todavía no figura acreditado." };
    case "ALREADY_CHECKED_IN":
      return { label: "Ya acreditado", description: "Esta persona ya entró." };
    case "ACCREDITATION_DISABLED":
      return { label: "Acreditación apagada", description: "La acreditación de este evento está apagada." };
    case "REGISTRATION_INACTIVE":
      return { label: "Entrada anulada", description: "La entrada fue anulada (pedido cancelado o dado de baja)." };
    case "QR_INVALID":
      return { label: "QR no válido", description: "El QR no corresponde a ninguna entrada de este evento." };
    case "SHORT_CODE_NOT_FOUND":
      return { label: "Código inexistente", description: "No hay ninguna entrada con ese código en este evento." };
    default:
      return {
        label: reason ? "Revisar acreditación" : "Sin motivo",
        description: "Revisá a la persona en el listado de inscriptos.",
      };
  }
}

/**
 * Qué hacer cuando el escaneo salió bien pero no se puede acreditar. Copiado de
 * `describirBloqueoDeAcreditacion` (Clickatón), con los motivos que existen acá.
 */
export function describirBloqueoDeAcreditacion(reason: string | null | undefined): string {
  switch (reason) {
    case "ACCREDITATION_DISABLED":
      return "La acreditación está apagada para este evento. Se enciende en la página del evento, en «Acreditación».";
    case "PAYMENT_PENDING":
      return "El pago todavía no figura acreditado. Cobrá en la puerta y acreditá con excepción, o marcalo como pagado en el listado.";
    case "REGISTRATION_INACTIVE":
      return "La entrada está anulada. No corresponde acreditar; si es un error, cambiá su estado en el listado.";
    default:
      return "No se puede confirmar la acreditación con el estado actual de esta entrada. Revisala en el listado de inscriptos.";
  }
}
