import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ReferralProgram, Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getOrCreateReferralCodeForUser } from "@/lib/referral-code-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/referrals/center — métricas del centro de referidos.
 * Organizadores: 403 (contrato legacy; usan otros flujos).
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (user.role === Role.ORGANIZER) {
      return NextResponse.json({ error: "No disponible" }, { status: 403 });
    }

    const referralCode = await getOrCreateReferralCodeForUser(user.id);

    const now = new Date();
    const activeWhere = {
      referrerUserId: user.id,
      status: "ACTIVE" as const,
      endsAt: { gt: now },
    };

    const [
      registeredUsers,
      activeReferrals,
      benefitsAgg,
      referredPhotographersCount,
      referredOrganizersCount,
      activePhotographersCount,
      activeOrganizersCount,
      photographerEarningsAgg,
      organizerEarningsAgg,
    ] = await Promise.all([
      prisma.referralAttribution.count({
        where: { referrerUserId: user.id },
      }),
      prisma.referralAttribution.count({ where: activeWhere }),
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId: user.id },
          reversedAt: null,
        },
        _sum: { referralAmountCents: true },
      }),
      prisma.referralAttribution.count({
        where: {
          referrerUserId: user.id,
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
        },
      }),
      prisma.referralAttribution.count({
        where: {
          referrerUserId: user.id,
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
        },
      }),
      prisma.referralAttribution.count({
        where: {
          ...activeWhere,
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
        },
      }),
      prisma.referralAttribution.count({
        where: {
          ...activeWhere,
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
        },
      }),
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId: user.id },
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
          reversedAt: null,
        },
        _sum: { referralAmountCents: true },
      }),
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId: user.id },
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
          reversedAt: null,
        },
        _sum: { referralAmountCents: true },
      }),
    ]);

    return NextResponse.json({
      referralCode: {
        code: referralCode.code,
        url: referralCode.url,
      },
      metrics: {
        clicksGenerated: null,
        registeredUsers,
        activeReferrals,
        benefitsGeneratedCents: benefitsAgg._sum.referralAmountCents ?? 0,
        referredPhotographersCount,
        referredOrganizersCount,
        activePhotographersCount,
        activeOrganizersCount,
        photographerReferralEarningsCents:
          photographerEarningsAgg._sum.referralAmountCents ?? 0,
        organizerReferralEarningsCents:
          organizerEarningsAgg._sum.referralAmountCents ?? 0,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/referrals/center ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo el centro de referidos" },
      { status: 500 }
    );
  }
}
