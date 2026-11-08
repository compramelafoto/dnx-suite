import { ReferralProgram, REFERRAL_PROGRAM_FEE_SHARE } from "@/lib/referral/referral-program";

export type RepartoPiloto = {
  fotografo: number;
  referidor: number;
  organizador: number;
  referidorOrganizador: number;
  plataforma: number;
};

/**
 * Reparto en pesos enteros, con las mismas cuentas que la contabilidad de CLF:
 * - el precio de la foto (total menos el recargo de la plataforma) es la base;
 * - el organizador cobra su porcentaje de la base (redondeado), y el fotógrafo el resto;
 * - el recargo se parte con los referidores según cada programa (los dos pueden coexistir) y
 *   lo que sobra, incluido el peso del redondeo, queda para la plataforma.
 */
export function calcularRepartoPiloto(params: {
  totalPesos: number;
  feePesos: number;
  hayReferidor: boolean;
  porcentajeOrganizador?: number;
  hayReferidorOrganizador?: boolean;
}): RepartoPiloto {
  const fee = Math.max(0, Math.round(params.feePesos));
  const total = Math.round(params.totalPesos);
  const base = total - fee;
  const pct = params.porcentajeOrganizador ?? 0;
  const organizador =
    Number.isFinite(pct) && pct > 0 && base > 0 ? Math.round((base * pct) / 100) : 0;
  const referidor = params.hayReferidor
    ? Math.floor(fee * REFERRAL_PROGRAM_FEE_SHARE[ReferralProgram.PHOTOGRAPHER_REFERRAL])
    : 0;
  const referidorOrganizador = params.hayReferidorOrganizador
    ? Math.floor(fee * REFERRAL_PROGRAM_FEE_SHARE[ReferralProgram.ORGANIZER_REFERRAL])
    : 0;
  return {
    fotografo: base - organizador,
    referidor,
    organizador,
    referidorOrganizador,
    plataforma: fee - referidor - referidorOrganizador,
  };
}
