import { prisma } from "@/lib/prisma";

const MIN_PAYOUT_PESOS_REF = 1;

/** Tras revertir earnings (reembolso), actualizar el monto de solicitudes de cobro PENDING del referidor. */
export async function recalcPendingPayoutRequestsForReferrers(referrerUserIds: number[]) {
  const uniq = [...new Set(referrerUserIds)];
  for (const referrerUserId of uniq) {
    const agg = await prisma.referralEarning.aggregate({
      where: {
        attribution: { referrerUserId },
        paidOutAt: null,
        reversedAt: null,
        appliedAt: null,
      },
      _sum: { referralAmountCents: true },
    });
    const newCents = agg._sum.referralAmountCents ?? 0;
    const data: { amountCents: number; status?: string } = { amountCents: newCents };
    if (newCents < MIN_PAYOUT_PESOS_REF) data.status = "CANCELLED";
    await prisma.referralPayoutRequest.updateMany({
      where: { referrerUserId, status: "PENDING" },
      data,
    });
  }
}
