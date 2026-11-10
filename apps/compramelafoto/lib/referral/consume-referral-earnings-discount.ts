import { prisma } from "@/lib/prisma";

type PendingEarning = { id: number; referralAmountCents: number };

export type ReferralDiscountConsumptionPlan = {
  /** Comisiones que el descuento cubre completas: se marcan aplicadas tal cual. */
  fullyAppliedIds: number[];
  /**
   * Comisión que el descuento cubre sólo en parte. La fila original queda pendiente con
   * `remainingCents` y se crea otra fila aplicada por `appliedCents`, para no perder el resto.
   */
  partial: { id: number; appliedCents: number; remainingCents: number } | null;
};

/**
 * Reparte un descuento entre comisiones pendientes, de la más vieja a la más nueva.
 * Función pura. Antes se marcaba aplicada entera la comisión que el descuento cubría a medias
 * y el referidor perdía la diferencia.
 */
export function planReferralDiscountConsumption(
  earnings: PendingEarning[],
  discountCents: number
): ReferralDiscountConsumptionPlan {
  const plan: ReferralDiscountConsumptionPlan = { fullyAppliedIds: [], partial: null };
  let remaining = Math.max(0, Math.round(Number(discountCents) || 0));

  for (const e of earnings) {
    if (remaining <= 0) break;
    const amount = Math.max(0, Math.round(Number(e.referralAmountCents) || 0));
    if (amount <= 0) continue;
    if (amount <= remaining) {
      plan.fullyAppliedIds.push(e.id);
      remaining -= amount;
      continue;
    }
    plan.partial = { id: e.id, appliedCents: remaining, remainingCents: amount - remaining };
    remaining = 0;
  }

  return plan;
}

/** Consume referral earnings del referidor para un descuento ya aplicado al fee de su venta (marca appliedAt). */
export async function consumeReferralEarningsForDiscount(
  referrerUserId: number,
  discountCents: number,
  orderId: number,
  orderType: "PRINT_ORDER" | "ALBUM_ORDER"
) {
  if (discountCents <= 0) return;

  await prisma.$transaction(async (tx) => {
    const earnings = await tx.referralEarning.findMany({
      where: {
        attribution: { referrerUserId },
        paidOutAt: null,
        reversedAt: null,
        appliedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        attributionId: true,
        paymentId: true,
        saleRef: true,
        referralAmountCents: true,
        referralProgram: true,
        createdAt: true,
      },
    });

    const plan = planReferralDiscountConsumption(earnings, discountCents);
    const now = new Date();
    const applied = { appliedAt: now, appliedToOrderId: orderId, appliedToOrderType: orderType };

    if (plan.fullyAppliedIds.length > 0) {
      await tx.referralEarning.updateMany({
        where: { id: { in: plan.fullyAppliedIds }, appliedAt: null },
        data: applied,
      });
    }

    const partial = plan.partial;
    const source = partial ? earnings.find((e) => e.id === partial.id) : undefined;
    if (partial && source) {
      // La fila original conserva su saleRef (la reversión por reembolso la sigue encontrando)
      // y queda pendiente con el resto. La parte usada pasa a una fila nueva, ya aplicada.
      await tx.referralEarning.update({
        where: { id: source.id },
        data: { referralAmountCents: partial.remainingCents },
      });
      await tx.referralEarning.create({
        data: {
          attributionId: source.attributionId,
          paymentId: source.paymentId,
          saleRef: `${source.saleRef ?? `EARNING:${source.id}`}#aplicado:${orderType}:${orderId}`,
          platformFeeCents: 0,
          referralAmountCents: partial.appliedCents,
          platformNetCents: 0,
          referralProgram: source.referralProgram,
          createdAt: source.createdAt,
          ...applied,
        },
      });
    }
  });
}
