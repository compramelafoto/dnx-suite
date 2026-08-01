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

/** Condiciones generales del beneficio (FAQ / contexto). */
export const ARGENTINA_2026_SHIRT_BENEFIT_COPY =
  "Remera oficial de regalo para los primeros 100 inscriptos con pago confirmado, o hasta el 30 de agosto, lo que ocurra primero. Elegí tu talle al completar tus datos.";

/** Mensaje cuando el beneficio está vigente para esta inscripción. */
export const ARGENTINA_2026_SHIRT_INCLUDED_COPY =
  "Te corresponde remera oficial de regalo: tu inscripción la incluye si el pago se confirma dentro del cupo (primeros 100 confirmados o hasta el 30 de agosto, lo que ocurra primero). Elegí tu talle al completar tus datos.";

/** Mensaje cuando cupo/plazo ya no aplican. */
export const ARGENTINA_2026_SHIRT_ENDED_COPY =
  "No te corresponde remera de regalo: el cupo de los primeros 100 ya se completó o venció el plazo del 30 de agosto. Podés inscribirte igual; la remera no está incluida.";

export type ShirtBenefitUiStatus = "available" | "ended" | "not_applicable";

/**
 * Estado de presentación del beneficio remera para el funnel público.
 * Usa flags resueltos en backend (first-N + deadline).
 */
export function resolveShirtBenefitUiStatus(input: {
  includesPhysicalMerch?: boolean | null;
  shirtBenefitAvailable?: boolean | null;
  shirtBenefitEnded?: boolean | null;
}): ShirtBenefitUiStatus {
  if (input.shirtBenefitEnded) return "ended";
  if (input.shirtBenefitAvailable) return "available";
  if (input.includesPhysicalMerch === false) return "not_applicable";
  if (input.includesPhysicalMerch && input.shirtBenefitAvailable === false) {
    return "ended";
  }
  return "not_applicable";
}

/** Copy corto para tarjeta / includes según si corresponde o no. */
export function presentShirtBenefitMessage(
  status: ShirtBenefitUiStatus,
): string | null {
  if (status === "available") return ARGENTINA_2026_SHIRT_INCLUDED_COPY;
  if (status === "ended") return ARGENTINA_2026_SHIRT_ENDED_COPY;
  return null;
}

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
