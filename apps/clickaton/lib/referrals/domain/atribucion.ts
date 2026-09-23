/**
 * Las reglas duras de la atribución, sin base de datos de por medio.
 *
 * Se evalúan en orden de especificidad: el motivo que queda registrado debe
 * ser el más informativo posible, para que la auditoría distinga un intento
 * de fraude de un código simplemente vencido.
 */

export type AtribucionOutcome =
  | "CREATED"
  | "CODE_NOT_FOUND"
  | "CODE_INACTIVE"
  | "SELF_REFERRAL"
  | "SAME_EMAIL"
  | "ALREADY_ATTRIBUTED"
  | "REFERRER_NOT_ELIGIBLE"
  | "ERROR";

export type EvaluacionAtribucion =
  | { ok: true; outcome: "CREATED" }
  | { ok: false; outcome: Exclude<AtribucionOutcome, "CREATED"> };

export type EntradaAtribucion = {
  codigoEncontrado: boolean;
  codigoActivo: boolean;
  referidorUserId: number | null;
  /** Sólo refiere quien tenga una inscripción CONFIRMED. */
  referidorEsParticipanteConfirmado: boolean;
  referidorEmail: string | null;
  referidoUserId: number | null;
  referidoEmail: string | null;
  /** El referido ya fue atribuido antes, en cualquier edición. */
  yaTieneAtribucion: boolean;
};

function mismoEmail(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function evaluarAtribucion(input: EntradaAtribucion): EvaluacionAtribucion {
  if (!input.codigoEncontrado || input.referidorUserId == null) {
    return { ok: false, outcome: "CODE_NOT_FOUND" };
  }
  if (!input.codigoActivo) {
    return { ok: false, outcome: "CODE_INACTIVE" };
  }

  // Lo específico antes que lo general: un autorreferido con un referidor
  // inelegible se registra como SELF_REFERRAL, que es lo que pasó de verdad.
  if (input.referidoUserId != null && input.referidoUserId === input.referidorUserId) {
    return { ok: false, outcome: "SELF_REFERRAL" };
  }
  if (mismoEmail(input.referidoEmail, input.referidorEmail)) {
    return { ok: false, outcome: "SAME_EMAIL" };
  }

  // Cada persona cuenta una sola vez en su vida: si el invitado vuelve solo
  // a una edición posterior, ese mérito ya se cobró.
  if (input.yaTieneAtribucion) {
    return { ok: false, outcome: "ALREADY_ATTRIBUTED" };
  }

  if (!input.referidorEsParticipanteConfirmado) {
    return { ok: false, outcome: "REFERRER_NOT_ELIGIBLE" };
  }

  if (input.referidoUserId == null) {
    return { ok: false, outcome: "ERROR" };
  }

  return { ok: true, outcome: "CREATED" };
}
