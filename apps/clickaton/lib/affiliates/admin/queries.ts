import { prisma } from "@/lib/admin/db";
import { readCouponAffiliate, type CouponAffiliate } from "@/lib/affiliates/domain/coupon-affiliate";
import { CLICKATON_PROMOTION_PLATFORM } from "@/lib/promotions/prisma-promotions-adapter";

/**
 * Lecturas del panel de afiliados y comisiones. Sin "use server": sólo las
 * usan páginas del servidor.
 */

export type CouponWithAffiliate = {
  promotionId: string;
  code: string;
  isActive: boolean;
  affiliate: CouponAffiliate;
};

/**
 * Cupones de Clickatón que tienen dueño. El dueño vive en `metadata`, así que
 * se filtra en JS: son pocos cupones.
 */
export async function listCouponsWithAffiliate(): Promise<CouponWithAffiliate[]> {
  const promotions = await prisma.dnxPromotion.findMany({
    where: { platform: CLICKATON_PROMOTION_PLATFORM },
    select: { id: true, code: true, isActive: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });
  const result: CouponWithAffiliate[] = [];
  for (const p of promotions) {
    const affiliate = readCouponAffiliate(p.metadata);
    if (affiliate) {
      result.push({ promotionId: p.id, code: p.code, isActive: p.isActive, affiliate });
    }
  }
  return result;
}

export async function listAffiliatesForAdmin() {
  const [affiliates, coupons] = await Promise.all([
    prisma.clickatonAffiliate.findMany({
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    }),
    listCouponsWithAffiliate(),
  ]);

  const userIds = affiliates
    .map((a) => a.userId)
    .filter((id): id is number => typeof id === "number");
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  return affiliates.map((a) => {
    const codes = coupons.filter((c) => c.affiliate.affiliateId === a.id);
    return {
      ...a,
      dnxEmail: a.userId != null ? (emailByUserId.get(a.userId) ?? null) : null,
      codes: codes.map((c) => ({ code: c.code, isActive: c.isActive, bps: c.affiliate.commissionBps })),
    };
  });
}

/** Para los selects: sólo los activos. */
export async function listActiveAffiliateOptions() {
  return prisma.clickatonAffiliate.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
}

export async function listAffiliateNames() {
  return prisma.clickatonAffiliate.findMany({
    select: { id: true, displayName: true, isActive: true },
    orderBy: { displayName: "asc" },
  });
}

export async function listCommissionsForAdmin(filters: {
  affiliateId?: string | null;
  editionId?: string | null;
}) {
  return prisma.clickatonAffiliateCommission.findMany({
    where: {
      ...(filters.affiliateId ? { affiliateId: filters.affiliateId } : {}),
      ...(filters.editionId ? { editionId: filters.editionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      affiliate: { select: { id: true, displayName: true } },
      edition: { select: { id: true, name: true } },
      registration: {
        select: { firstName: true, lastName: true, email: true, visibleCode: true },
      },
    },
  });
}
