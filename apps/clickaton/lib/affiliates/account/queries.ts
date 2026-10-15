import { prisma } from "@repo/db";

import { readCouponAffiliate } from "@/lib/affiliates/domain/coupon-affiliate";
import {
  normalizeAffiliateConsentStatus,
  type AffiliateConsentStatus,
} from "@/lib/affiliates/domain/labels";
import { summarizeCommissions, type CommissionTotals } from "@/lib/affiliates/ui/presentation";
import { CLICKATON_PROMOTION_PLATFORM } from "@/lib/promotions/prisma-promotions-adapter";

export type MyAffiliateView = {
  affiliateId: string;
  displayName: string;
  consentStatus: AffiliateConsentStatus;
  inviteUrl: string | null;
  hasReceiver: boolean;
  codes: Array<{
    code: string;
    isActive: boolean;
    commissionBps: number;
    /** Usos vigentes (reservados o confirmados). */
    uses: number;
  }>;
  totals: CommissionTotals;
};

/**
 * Mi cuenta del fotógrafo afiliado: sus códigos, usos, comisiones por estado y
 * cómo está su vinculación con Mercado Pago. Devuelve null si el usuario no es
 * afiliado (o está desactivado).
 */
export async function loadMyAffiliate(userId: number): Promise<MyAffiliateView | null> {
  const affiliate = await prisma.clickatonAffiliate.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      isActive: true,
      consentStatus: true,
      consentInviteUrl: true,
      consentReceiverId: true,
    },
  });
  if (!affiliate || !affiliate.isActive) return null;

  const [promotions, commissions] = await Promise.all([
    prisma.dnxPromotion.findMany({
      where: { platform: CLICKATON_PROMOTION_PLATFORM },
      select: { id: true, code: true, isActive: true, metadata: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clickatonAffiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      select: { status: true, netAmount: true },
    }),
  ]);

  const mine = promotions
    .map((p) => ({ p, owner: readCouponAffiliate(p.metadata) }))
    .filter(({ owner }) => owner?.affiliateId === affiliate.id);

  const uses = await Promise.all(
    mine.map(({ p }) =>
      prisma.dnxPromotionRedemption.count({
        where: { promotionId: p.id, status: { in: ["RESERVED", "CONFIRMED"] } },
      }),
    ),
  );

  return {
    affiliateId: affiliate.id,
    displayName: affiliate.displayName,
    consentStatus: normalizeAffiliateConsentStatus(affiliate.consentStatus),
    inviteUrl: affiliate.consentInviteUrl,
    hasReceiver: Boolean(affiliate.consentReceiverId?.trim()),
    codes: mine.map(({ p, owner }, i) => ({
      code: p.code,
      isActive: p.isActive,
      commissionBps: owner?.commissionBps ?? 0,
      uses: uses[i] ?? 0,
    })),
    totals: summarizeCommissions(commissions),
  };
}
