/**
 * Dueño de un cupón: `DnxPromotion.metadata.affiliate`.
 *
 * Va en `metadata` y no en una columna porque `DnxPromotion` la comparten tres
 * bases: una columna sin aplicar en cualquiera de ellas rompe todo el modelo.
 */

export type CouponAffiliate = {
  affiliateId: string;
  /** Comisión del fotógrafo en puntos básicos (1000 = 10%). 1..10000. */
  commissionBps: number;
};

type Metadata = Record<string, unknown>;

function isValidCommissionBps(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 10_000
  );
}

/**
 * Lee el dueño del cupón. Devuelve null si no tiene o si está malformado: un
 * cupón con metadata rota sigue siendo un cupón, pero sin comisión.
 */
export function readCouponAffiliate(metadata: unknown): CouponAffiliate | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Metadata).affiliate;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as { affiliateId?: unknown; commissionBps?: unknown };
  if (typeof candidate.affiliateId !== "string") return null;
  const affiliateId = candidate.affiliateId.trim();
  if (affiliateId.length === 0) return null;
  if (!isValidCommissionBps(candidate.commissionBps)) return null;

  return { affiliateId, commissionBps: candidate.commissionBps };
}

/**
 * Devuelve una metadata nueva con el dueño puesto (o sacado, con null). Conserva
 * el resto de las claves, por ejemplo `eligibility`.
 */
export function withCouponAffiliate(
  metadata: unknown,
  value: CouponAffiliate | null,
): Metadata {
  const base: Metadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Metadata) }
      : {};

  if (value === null) {
    delete base.affiliate;
    return base;
  }

  const affiliateId = value.affiliateId.trim();
  if (affiliateId.length === 0) {
    throw new Error("El código de fotógrafo necesita un afiliado.");
  }
  if (!isValidCommissionBps(value.commissionBps)) {
    throw new Error("La comisión debe estar entre 0,01% y 100%.");
  }
  base.affiliate = { affiliateId, commissionBps: value.commissionBps };
  return base;
}
