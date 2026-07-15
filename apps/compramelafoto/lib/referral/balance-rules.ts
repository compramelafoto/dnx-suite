/**
 * Reglas puras de saldo / elegibilidad de payout (sin Prisma).
 * Los campos *Cents de referidos almacenan PESOS (ARS).
 */

export const MIN_PAYOUT_PESOS = 1;

export const availableEarningWhere = {
  paidOutAt: null as null,
  reversedAt: null as null,
  appliedAt: null as null,
};

export type PayoutEligibility =
  | { ok: true; balancePesos: number }
  | { ok: false; error: string; status: number; balancePesos: number };

export function evaluatePayoutEligibility(params: {
  balancePesos: number;
  hasPending: boolean;
  cbu: string | null | undefined;
  cbuTitular: string | null | undefined;
}): PayoutEligibility {
  const cbuOk = (params.cbu ?? "").trim().length > 0;
  const titularOk = (params.cbuTitular ?? "").trim().length > 0;
  if (!cbuOk || !titularOk) {
    return {
      ok: false,
      status: 400,
      balancePesos: params.balancePesos,
      error:
        "Para solicitar el cobro tenés que cargar CBU o Alias y el titular de la cuenta en la sección «Datos para cobro».",
    };
  }
  if (params.hasPending) {
    return {
      ok: false,
      status: 409,
      balancePesos: params.balancePesos,
      error:
        "Ya tenés una solicitud de cobro pendiente. Esperá a que sea procesada.",
    };
  }
  if (params.balancePesos < MIN_PAYOUT_PESOS) {
    return {
      ok: false,
      status: 400,
      balancePesos: params.balancePesos,
      error: `El saldo mínimo para solicitar cobro es $${MIN_PAYOUT_PESOS.toFixed(2)}. Tu saldo actual es $${params.balancePesos.toFixed(2)}.`,
    };
  }
  return { ok: true, balancePesos: params.balancePesos };
}
