import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "./types";

/**
 * ¿Esta inscripción ya tiene a la persona que va a participar?
 *
 * Durante años "pago aprobado" y "hay un participante" fueron lo mismo en
 * Clickatón, así que medio código pregunta lo primero para decidir lo
 * segundo. Los regalos rompieron esa equivalencia: entre que se paga y que
 * alguien lo activa, la inscripción está **paga y sin participante** — los
 * datos que tiene son los de quien lo compró.
 *
 * Todo lo que dependa de quién participa —placas, sincronización con
 * FotoRank, credenciales, publicaciones, padrones— tiene que preguntar acá y
 * no mirar `paymentStatus` por su cuenta. Un regalo sin activar que se cuela
 * sale con el nombre de otra persona, y nadie se entera hasta que el
 * participante lo ve.
 */
export function tieneParticipanteDefinido(registration: {
  status: ClickatonRegistrationStatus | string;
  paymentStatus?: ClickatonPaymentStatus | string;
}): boolean {
  // El único estado pago sin participante. Se nombra explícito para que
  // agregar otro estado así obligue a pasar por acá.
  if (registration.status === "GIFT_AWAITING_REDEMPTION") return false;
  return registration.status === "CONFIRMED";
}

/**
 * Los estados que ocupan un lugar pagado pero todavía no tienen participante.
 *
 * Existe para las consultas a la base, que no pueden llamar a la función de
 * arriba: `status: { notIn: [...ESTADOS_SIN_PARTICIPANTE] }`. Un test obliga a
 * que las dos digan lo mismo.
 */
export const ESTADOS_SIN_PARTICIPANTE = ["GIFT_AWAITING_REDEMPTION"] as const;

/**
 * Motivo legible cuando no hay participante todavía, para los registros
 * internos que hoy dicen "NOT_PAID" y confunden: el regalo SÍ está pago.
 */
export function motivoSinParticipante(registration: {
  status: ClickatonRegistrationStatus | string;
}): "GIFT_NOT_REDEEMED" | "NOT_CONFIRMED" {
  return registration.status === "GIFT_AWAITING_REDEMPTION"
    ? "GIFT_NOT_REDEEMED"
    : "NOT_CONFIRMED";
}
