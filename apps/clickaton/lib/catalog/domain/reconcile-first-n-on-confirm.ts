/**
 * Al confirmar pago: quita ítems de beneficio first-N si ya no hay cupo CONFIRMED
 * o si confirmedAt supera benefitDeadlineAt.
 * Serializa contando solo CONFIRMED (excluye la propia inscripción hasta que se confirme).
 */
import { isConfirmedBenefitEligible } from "./first-n-benefit";

export type BenefitItemRow = {
  id: string;
  pricePhaseItemId: string | null;
  productId: string | null;
};

export type BenefitPhaseMeta = {
  id: string;
  productId: string;
  stockLimit: number | null;
  benefitDeadlineAt: Date | null;
};

export function selectBenefitItemsToRevoke(input: {
  items: BenefitItemRow[];
  phaseMetaById: Map<string, BenefitPhaseMeta>;
  /** CONFIRMED count by productId BEFORE confirming this registration. */
  confirmedByProductId: Map<string, number>;
  confirmedAt: Date;
}): { revokeItemIds: string[]; reasonByItemId: Map<string, string> } {
  const revokeItemIds: string[] = [];
  const reasonByItemId = new Map<string, string>();
  /** Simula asignación secuencial dentro del mismo batch (race test). */
  const provisional = new Map(input.confirmedByProductId);

  for (const item of input.items) {
    if (!item.pricePhaseItemId) continue;
    const meta = input.phaseMetaById.get(item.pricePhaseItemId);
    if (!meta || meta.stockLimit == null) continue;

    const before = provisional.get(meta.productId) ?? 0;
    const ok = isConfirmedBenefitEligible({
      stockLimit: meta.stockLimit,
      confirmedBeneficiariesBeforeThis: before,
      confirmedAt: input.confirmedAt,
      benefitDeadlineAt: meta.benefitDeadlineAt,
    });
    if (!ok) {
      revokeItemIds.push(item.id);
      reasonByItemId.set(
        item.id,
        input.confirmedAt.getTime() > (meta.benefitDeadlineAt?.getTime() ?? Infinity)
          ? "benefit_deadline_passed"
          : "first_n_quota_exhausted",
      );
      continue;
    }
    provisional.set(meta.productId, before + 1);
  }

  return { revokeItemIds, reasonByItemId };
}
