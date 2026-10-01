/**
 * ¿Puede acreditarse sola, con el QR del instructivo, una persona que recibió
 * el kit por correo? A propósito NO mira el interruptor de acreditación ni la
 * ventana horaria del día del evento: el kit llega días antes, y quien está
 * lejos no tiene a nadie que le abra la puerta.
 */
export type KitSelfConfirmState =
  | "CAN_CONFIRM"
  | "ALREADY_ACCREDITED"
  /** Inscripción sin pagar, cancelada o reembolsada. */
  | "NOT_CONFIRMED"
  | "NO_CREDENTIAL"
  | "EDITION_OVER";

export function evaluateKitSelfConfirm(input: {
  registrationStatus: string;
  paymentStatus: string;
  hasActiveCredential: boolean;
  alreadyCheckedIn: boolean;
  editionEndAt: Date | null;
  now: Date;
}): KitSelfConfirmState {
  if (input.alreadyCheckedIn) return "ALREADY_ACCREDITED";
  if (
    input.registrationStatus !== "CONFIRMED" ||
    (input.paymentStatus !== "APPROVED" && input.paymentStatus !== "NOT_REQUIRED")
  ) {
    return "NOT_CONFIRMED";
  }
  if (input.editionEndAt && input.now.getTime() > input.editionEndAt.getTime()) {
    return "EDITION_OVER";
  }
  if (!input.hasActiveCredential) return "NO_CREDENTIAL";
  return "CAN_CONFIRM";
}

export const KIT_SELF_CONFIRM_MESSAGE: Record<Exclude<KitSelfConfirmState, "CAN_CONFIRM">, string> = {
  ALREADY_ACCREDITED: "Ya estás acreditado. ¡Nos vemos en la maratón!",
  NOT_CONFIRMED:
    "Tu inscripción todavía no figura como pagada. Si ya pagaste, escribinos y lo revisamos.",
  NO_CREDENTIAL:
    "Tu credencial todavía no está lista. Escribinos y te acreditamos a mano.",
  EDITION_OVER: "Esta maratón ya terminó.",
};
