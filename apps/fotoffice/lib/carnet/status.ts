import type { Delinquency } from "./delinquency";

/**
 * Si el carnet habilita o no.
 *
 * `habilitado` **no se guarda**: se calcula cada vez que alguien mira. El esquema ya separa
 * la condición institucional —una decisión, con fecha y responsable— de la situación
 * financiera, que cambia sola. Guardar un campo "habilitado" volvería a mezclarlas y habría
 * que sincronizarlo con cada pago.
 *
 * De calcularlo sale gratis lo que el socio pidió: paga a las 11 de la noche y aparece
 * habilitado a las 11 y un minuto, sin que ningún proceso tenga que acordarse de nada.
 */

export type MemberInstitutionalStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export type CardFacts = {
  memberStatus: MemberInstitutionalStatus;
  revokedAt: Date | null;
  validUntil: Date;
  delinquency: Delinquency;
  now: Date;
};

/**
 * Por qué no habilita. **No se muestra en el nivel 1**: quien escanea en la puerta de un
 * evento necesita saber si pasa o no, y por qué no pasa no es asunto suyo. Sirve para el
 * propio socio y para la institución.
 */
export type DisabledReason =
  | "NOT_A_MEMBER"
  | "SUSPENDED"
  | "CARD_REVOKED"
  | "CARD_EXPIRED"
  /** Todavía no pagó su inscripción. No es mora: está entrando. */
  | "PENDING_ENTRY"
  | "DELINQUENT";

export type CardStatus = {
  enabled: boolean;
  reason: DisabledReason | null;
  expired: boolean;
  revoked: boolean;
};

export function computeCardStatus(facts: CardFacts): CardStatus {
  const revoked = facts.revokedAt !== null && facts.revokedAt.getTime() <= facts.now.getTime();
  const expired = facts.validUntil.getTime() <= facts.now.getTime();

  // El orden importa para el motivo, no para el resultado: se informa la razón más de fondo.
  // A quien ya no es socio no tiene sentido decirle que su carnet venció.
  let reason: DisabledReason | null = null;
  if (facts.memberStatus === "INACTIVE") reason = "NOT_A_MEMBER";
  else if (facts.memberStatus === "SUSPENDED") reason = "SUSPENDED";
  else if (revoked) reason = "CARD_REVOKED";
  else if (expired) reason = "CARD_EXPIRED";
  // La inscripción impaga va antes que la mora: quien todavía no completó su ingreso no está
  // atrasado, está entrando. Decirle "regularizá tu deuda" sería tratarlo de deudor el primer
  // día, y encima no le explicaría qué tiene que hacer.
  else if (facts.delinquency.pendingEntry) reason = "PENDING_ENTRY";
  else if (facts.delinquency.delinquent) reason = "DELINQUENT";

  return { enabled: reason === null, reason, expired, revoked };
}

/** Texto para el propio socio y para la institución. Nunca para el nivel 1. */
export function explainDisabled(reason: DisabledReason): string {
  switch (reason) {
    case "NOT_A_MEMBER":
      return "Ya no figurás como socio de la institución.";
    case "SUSPENDED":
      return "Tu condición de socio está suspendida. Comunicate con la Secretaría.";
    case "CARD_REVOKED":
      return "Este carnet fue dado de baja. Pedí uno nuevo a la Secretaría.";
    case "CARD_EXPIRED":
      return "Este carnet venció. Se renueva solo; si no aparece uno nuevo, avisale a la Secretaría.";
    case "PENDING_ENTRY":
      return "Te falta pagar la inscripción. Se abona de una sola vez y con eso quedás habilitado.";
    case "DELINQUENT":
      return "Tenés cuotas impagas que superan lo que permite el estatuto. Regularizá para volver a estar habilitado.";
  }
}
