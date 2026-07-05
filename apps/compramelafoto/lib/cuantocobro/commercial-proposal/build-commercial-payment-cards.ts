import type { CuantoCobroPaymentOptionsSnapshot } from "../payment/payment-options-types";
import { hasPaymentOptionsPresentation } from "../payment/payment-options-calc";
import type { CommercialProposalPaymentCard } from "./commercial-proposal-types";

export function buildCommercialPaymentCards(
  snapshot: CuantoCobroPaymentOptionsSnapshot | null | undefined,
  fmt: (amount: number) => string,
): CommercialProposalPaymentCard[] {
  if (!snapshot || !hasPaymentOptionsPresentation(snapshot)) return [];

  const cards: CommercialProposalPaymentCard[] = [];

  if (snapshot.cash?.enabled) {
    cards.push({
      id: "cash",
      title: "Pago en un solo pago",
      amount: fmt(snapshot.cash.cashPrice),
      subtitle:
        snapshot.cash.discountPercent > 0
          ? `Incluye ${snapshot.cash.discountPercent}% de descuento por contado`
          : undefined,
      note: snapshot.cash.commercialNote.trim() || undefined,
    });
  }

  for (const plan of snapshot.installmentPlans) {
    const count = plan.numberOfInstallments;
    cards.push({
      id: plan.id,
      title: count === 1 ? "Pago en una cuota" : `Plan en ${count} cuotas`,
      amount: `${fmt(plan.installmentAmount)} por cuota`,
      subtitle: `Total del plan: ${fmt(plan.financedTotal)}`,
      note: plan.commercialNote.trim() || undefined,
    });
  }

  return cards;
}
