import { ReferralProgram, REFERRAL_PROGRAM_FEE_SHARE } from "@/lib/referral/referral-program";

export type RepartoPiloto = { fotografo: number; referidor: number; plataforma: number };

/**
 * Reparto en pesos enteros. El fotógrafo cobra el precio (total menos el recargo de la
 * plataforma); el recargo se parte con el referidor según el programa de referidos de
 * fotógrafos, y el peso que sobra del redondeo queda para la plataforma.
 */
export function calcularRepartoPiloto(params: {
  totalPesos: number;
  feePesos: number;
  hayReferidor: boolean;
}): RepartoPiloto {
  const fee = Math.max(0, Math.round(params.feePesos));
  const total = Math.round(params.totalPesos);
  const referidor = params.hayReferidor
    ? Math.floor(fee * REFERRAL_PROGRAM_FEE_SHARE[ReferralProgram.PHOTOGRAPHER_REFERRAL])
    : 0;
  return { fotografo: total - fee, referidor, plataforma: fee - referidor };
}
