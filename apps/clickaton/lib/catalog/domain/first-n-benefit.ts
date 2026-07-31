/**
 * First-N + deadline benefit (cupo de beneficio) ≠ capacidad de fase/edición.
 *
 * - `stockLimit` = cupo máximo de beneficiarios CONFIRMED.
 * - `benefitDeadlineAt` = cierre temporal del beneficio (independiente del precio/fase).
 * - Agotado o vencido → se omite el ítem; la inscripción sigue.
 * - Nunca lanzar PHASE_CAPACITY_EXCEEDED por first-N.
 *
 * Beneficio definitivo (canónico):
 *   CONFIRMED ∧ confirmedAt ≤ deadline ∧ confirmedBeneficiaries < stockLimit
 *
 * Holds PENDING solo reservan soft el cupo en checkout (anti-oversell), no son
 * consumidores definitivos.
 */

export type FirstNPhaseItem = {
  id: string;
  productId?: string | null;
  stockLimit?: number | null;
  /** Instant inclusive end of benefit window (UTC Date). */
  benefitDeadlineAt?: Date | null;
  quantity?: number;
};

/** Fin de día 30/08/2026 America/Argentina/Buenos_Aires (= UTC−3). */
export const ARGENTINA_2026_SHIRT_BENEFIT_DEADLINE = new Date(
  "2026-08-30T23:59:59.999-03:00",
);

export const ARGENTINA_2026_SHIRT_BENEFIT_COPY =
  "Remera Clickatón incluida para los primeros 100 inscriptos con pago confirmado o hasta el 30 de agosto, lo que ocurra primero.";

export const ARGENTINA_2026_SHIRT_INCLUDED_COPY =
  "Tu inscripción incluye remera Clickatón.";

export const ARGENTINA_2026_SHIRT_ENDED_COPY =
  "La promoción de remera incluida ya finalizó.";

export function isBenefitDeadlineOpen(input: {
  now: Date;
  benefitDeadlineAt: Date | null | undefined;
}): boolean {
  if (input.benefitDeadlineAt == null) return true;
  return input.now.getTime() <= input.benefitDeadlineAt.getTime();
}

/**
 * Disponibilidad de oferta (UI + reserva).
 * `confirmedClaims` = solo CONFIRMED (definitivos).
 * `heldClaims` = PENDING_PAYMENT con hold ACTIVE (soft, anti-oversell).
 */
export function isFirstNBenefitAvailable(input: {
  stockLimit: number | null | undefined;
  confirmedClaims: number;
  heldClaims?: number;
  now?: Date;
  benefitDeadlineAt?: Date | null;
}): boolean {
  const now = input.now ?? new Date();
  if (!isBenefitDeadlineOpen({ now, benefitDeadlineAt: input.benefitDeadlineAt })) {
    return false;
  }
  if (input.stockLimit == null) return true;
  if (input.stockLimit < 1) return false;
  const soft = input.confirmedClaims + (input.heldClaims ?? 0);
  return soft < input.stockLimit;
}

/** Elegibilidad definitiva al confirmar pago. */
export function isConfirmedBenefitEligible(input: {
  stockLimit: number | null | undefined;
  confirmedBeneficiariesBeforeThis: number;
  confirmedAt: Date;
  benefitDeadlineAt?: Date | null;
}): boolean {
  if (
    !isBenefitDeadlineOpen({
      now: input.confirmedAt,
      benefitDeadlineAt: input.benefitDeadlineAt,
    })
  ) {
    return false;
  }
  if (input.stockLimit == null) return true;
  if (input.stockLimit < 1) return false;
  return input.confirmedBeneficiariesBeforeThis < input.stockLimit;
}

export function filterPhaseItemsByFirstNQuota<T extends FirstNPhaseItem>(
  items: T[],
  claims: {
    confirmedByItemId?: Map<string, number>;
    heldByItemId?: Map<string, number>;
    /** Preferido: cupo compartido por producto en la edición. */
    confirmedByProductId?: Map<string, number>;
    heldByProductId?: Map<string, number>;
    now?: Date;
  },
): { available: T[]; omitted: T[] } {
  const now = claims.now ?? new Date();
  const available: T[] = [];
  const omitted: T[] = [];
  for (const item of items) {
    const productId = item.productId ?? null;
    const confirmed = productId
      ? (claims.confirmedByProductId?.get(productId) ??
          claims.confirmedByItemId?.get(item.id) ??
          0)
      : (claims.confirmedByItemId?.get(item.id) ?? 0);
    const held = productId
      ? (claims.heldByProductId?.get(productId) ??
          claims.heldByItemId?.get(item.id) ??
          0)
      : (claims.heldByItemId?.get(item.id) ?? 0);
    if (
      isFirstNBenefitAvailable({
        stockLimit: item.stockLimit,
        confirmedClaims: confirmed,
        heldClaims: held,
        now,
        benefitDeadlineAt: item.benefitDeadlineAt,
      })
    ) {
      available.push(item);
    } else {
      omitted.push(item);
    }
  }
  return { available, omitted };
}

export type BenefitOfferStatus = "INCLUDED" | "ENDED" | "NOT_APPLICABLE";

export function resolveBenefitOfferStatus(input: {
  hasBenefitItems: boolean;
  benefitAvailable: boolean;
}): BenefitOfferStatus {
  if (!input.hasBenefitItems && !input.benefitAvailable) {
    // Puede ser fase sin merch o promoción finalizada — el caller distingue con copy.
    return input.benefitAvailable ? "INCLUDED" : "ENDED";
  }
  if (input.hasBenefitItems && input.benefitAvailable) return "INCLUDED";
  if (!input.hasBenefitItems) return "ENDED";
  return "NOT_APPLICABLE";
}
