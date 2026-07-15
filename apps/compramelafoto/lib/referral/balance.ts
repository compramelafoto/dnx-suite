import { prisma } from "@/lib/prisma";
import {
  availableEarningWhere,
  evaluatePayoutEligibility,
  MIN_PAYOUT_PESOS,
} from "@/lib/referral/balance-rules";

export {
  availableEarningWhere,
  evaluatePayoutEligibility,
  MIN_PAYOUT_PESOS,
};

export function availableEarningFilterForReferrer(referrerUserId: number) {
  return {
    attribution: { referrerUserId },
    ...availableEarningWhere,
  };
}

export async function getReferrerAvailableBalancePesos(
  referrerUserId: number
): Promise<number> {
  const agg = await prisma.referralEarning.aggregate({
    where: availableEarningFilterForReferrer(referrerUserId),
    _sum: { referralAmountCents: true },
  });
  return agg._sum.referralAmountCents ?? 0;
}

export async function getReferrerTotalPaidPesos(
  referrerUserId: number
): Promise<number> {
  const agg = await prisma.referralEarning.aggregate({
    where: {
      attribution: { referrerUserId },
      paidOutAt: { not: null },
    },
    _sum: { referralAmountCents: true },
  });
  return agg._sum.referralAmountCents ?? 0;
}

export async function hasPendingPayoutRequest(
  referrerUserId: number
): Promise<boolean> {
  const pending = await prisma.referralPayoutRequest.findFirst({
    where: { referrerUserId, status: "PENDING" },
    select: { id: true },
  });
  return Boolean(pending);
}
