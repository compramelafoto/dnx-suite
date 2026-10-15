/**
 * Borrador de la comisión que se guarda junto con la inscripción (PENDING).
 * Puro: el servicio de inscripción le pasa lo que ya sabe y decide si guardar.
 */

import { computeAffiliateCommission } from "./commission";
import type { CouponAffiliate } from "./coupon-affiliate";

export type AffiliateCommissionDraft = {
  affiliateId: string;
  promotionId: string;
  promotionCodeSnapshot: string;
  commissionBps: number;
  /** Precio de lista, sin descuento ni envío. */
  baseAmount: number;
  grossAmount: number;
  mpFeeBps: number;
  mpFeeShareAmount: number;
  netAmount: number;
};

export type AffiliateCommissionDraftInput = {
  affiliate: CouponAffiliate | null;
  affiliateActive: boolean;
  promotionId: string;
  promotionCode: string;
  /** Precio de lista (antes del cupón; nunca incluye el envío). */
  baseAmount: number;
  /** Lo que paga el participante: con descuento y con envío. */
  totalAmount: number;
  mpFeeBps: number;
};

/** Variable de entorno con la comisión de MP por defecto (puntos básicos). */
export const DEFAULT_MP_FEE_BPS_ENV = "DNX_CLICKATON_AFFILIATE_DEFAULT_MP_FEE_BPS";

/**
 * Comisión de MP a descontarle al afiliado: la de la edición ("Números"); si
 * no está cargada, la de la variable de entorno; si no, 0. Un valor inválido
 * se ignora (nunca rompe la inscripción).
 */
export function resolveAffiliateMpFeeBps(
  editionBps: number | null | undefined,
  envRaw: string | null | undefined,
): number {
  if (isValidBps(editionBps)) return editionBps;
  const trimmed = envRaw?.trim() ?? "";
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (isValidBps(parsed)) return parsed;
  }
  return 0;
}

function isValidBps(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10_000;
}

/**
 * Devuelve el borrador o null si no corresponde comisión: cupón sin dueño,
 * afiliado desactivado, inscripción sin cobro ($0) o comisión bruta nula.
 *
 * Si el neto queda en cero (por ejemplo, MP se lleva todo), igual se anota:
 * la decide una persona. Si el cálculo no se puede hacer con la comisión de MP
 * recibida, se recalcula sin ella antes de rendirse.
 */
export function buildAffiliateCommissionDraft(
  input: AffiliateCommissionDraftInput,
): AffiliateCommissionDraft | null {
  if (!input.affiliate || !input.affiliateActive) return null;
  if (!(input.totalAmount > 0) || !(input.baseAmount > 0)) return null;

  const attempt = (mpFeeBps: number) => {
    try {
      return {
        mpFeeBps,
        result: computeAffiliateCommission({
          baseAmount: input.baseAmount,
          totalAmount: input.totalAmount,
          commissionBps: input.affiliate!.commissionBps,
          mpFeeBps,
        }),
      };
    } catch {
      return null;
    }
  };

  const computed = attempt(input.mpFeeBps) ?? attempt(0);
  if (!computed || computed.result.grossAmount <= 0) return null;

  return {
    affiliateId: input.affiliate.affiliateId,
    promotionId: input.promotionId,
    promotionCodeSnapshot: input.promotionCode,
    commissionBps: input.affiliate.commissionBps,
    baseAmount: input.baseAmount,
    grossAmount: computed.result.grossAmount,
    mpFeeBps: computed.mpFeeBps,
    mpFeeShareAmount: computed.result.mpFeeShareAmount,
    netAmount: computed.result.netAmount,
  };
}
