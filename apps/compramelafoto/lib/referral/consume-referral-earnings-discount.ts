import { prisma } from "@/lib/prisma";

/** Consume referral earnings del referidor para un descuento ya aplicado al fee de su venta (marca appliedAt). */
export async function consumeReferralEarningsForDiscount(
  referrerUserId: number,
  discountCents: number,
  orderId: number,
  orderType: "PRINT_ORDER" | "ALBUM_ORDER"
) {
  if (discountCents <= 0) return;
  const earnings = await prisma.referralEarning.findMany({
    where: {
      attribution: { referrerUserId },
      paidOutAt: null,
      reversedAt: null,
      appliedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, referralAmountCents: true },
  });
  let remaining = discountCents;
  const now = new Date();
  for (const e of earnings) {
    if (remaining <= 0) break;
    await prisma.referralEarning.update({
      where: { id: e.id },
      data: {
        appliedAt: now,
        appliedToOrderId: orderId,
        appliedToOrderType: orderType,
      },
    });
    remaining -= e.referralAmountCents;
  }
}
