import { ReferralProgram } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { maskEmail, maskName } from "@/lib/referral-helpers";

const EARNING_BASE_WHERE = {
  reversedAt: null as null,
};

export type ReferredUserRow = {
  id: number;
  maskedEmail: string;
  maskedName: string;
  createdAt: string;
  status: string;
  salesCount: number;
  earningsGeneratedCents: number;
  referralProgram: ReferralProgram;
  referralOriginLabel: string | null;
};

export type ReferralProgramStats = {
  referredPhotographersCount: number;
  referredOrganizersCount: number;
  activePhotographersCount: number;
  activeOrganizersCount: number;
  photographerReferralEarningsCents: number;
  organizerReferralEarningsCents: number;
  photographerBalanceCents: number;
  organizerBalanceCents: number;
};

async function getSalesCountForPhotographer(userId: number): Promise<number> {
  const [albumOrders, printOrders] = await Promise.all([
    prisma.order.count({
      where: {
        album: { userId },
        status: "PAID",
      },
    }),
    prisma.printOrder.count({
      where: {
        photographerId: userId,
        paymentStatus: "PAID",
      },
    }),
  ]);
  return albumOrders + printOrders;
}

async function getPaidOrdersOnOrganizerEvents(organizerUserId: number): Promise<number> {
  return prisma.order.count({
    where: {
      status: "PAID",
      album: {
        event: { creatorId: organizerUserId },
      },
    },
  });
}

function resolveAttributionStatus(status: string, endsAt: Date): string {
  if (status !== "ACTIVE") return status;
  return new Date() > endsAt ? "EXPIRED" : "ACTIVE";
}

export async function buildReferredRowsForReferrer(
  referrerUserId: number,
  talkTitleById: Record<number, string>
): Promise<ReferredUserRow[]> {
  const attributions = await prisma.referralAttribution.findMany({
    where: { referrerUserId },
    include: {
      referredUser: {
        select: { id: true, email: true, name: true, createdAt: true },
      },
      earnings: {
        where: EARNING_BASE_WHERE,
        select: { referralAmountCents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    attributions.map(async (a) => {
      const earningsGeneratedCents = a.earnings.reduce(
        (sum, e) => sum + e.referralAmountCents,
        0
      );

      const salesCount =
        a.referralProgram === ReferralProgram.ORGANIZER_REFERRAL
          ? await getPaidOrdersOnOrganizerEvents(a.referredUserId)
          : await getSalesCountForPhotographer(a.referredUserId);

      let referralOriginLabel: string | null = null;
      if (a.sourceType === "TRAINING" && a.sourceEntityId) {
        const title = talkTitleById[a.sourceEntityId];
        referralOriginLabel = title
          ? `Capacitación: ${title}`
          : "Capacitación (charla)";
      } else if (a.sourceType && a.sourceType !== "GENERAL") {
        referralOriginLabel = a.sourceType;
      }

      return {
        id: a.id,
        maskedEmail: maskEmail(a.referredUser.email),
        maskedName: maskName(a.referredUser.name),
        createdAt: a.createdAt.toISOString(),
        status: resolveAttributionStatus(a.status, a.endsAt),
        salesCount,
        earningsGeneratedCents,
        referralProgram: a.referralProgram,
        referralOriginLabel,
      };
    })
  );
}

export async function buildReferralProgramStats(
  referrerUserId: number,
  referred: ReferredUserRow[]
): Promise<ReferralProgramStats> {
  const referredPhotographersCount = referred.filter(
    (r) => r.referralProgram === ReferralProgram.PHOTOGRAPHER_REFERRAL
  ).length;
  const referredOrganizersCount = referred.filter(
    (r) => r.referralProgram === ReferralProgram.ORGANIZER_REFERRAL
  ).length;
  const activePhotographersCount = referred.filter(
    (r) =>
      r.referralProgram === ReferralProgram.PHOTOGRAPHER_REFERRAL && r.status === "ACTIVE"
  ).length;
  const activeOrganizersCount = referred.filter(
    (r) =>
      r.referralProgram === ReferralProgram.ORGANIZER_REFERRAL && r.status === "ACTIVE"
  ).length;

  const [photographerEarningsAgg, organizerEarningsAgg, photographerBalanceAgg, organizerBalanceAgg] =
    await Promise.all([
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId },
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
          ...EARNING_BASE_WHERE,
        },
        _sum: { referralAmountCents: true },
      }),
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId },
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
          ...EARNING_BASE_WHERE,
        },
        _sum: { referralAmountCents: true },
      }),
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId },
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
          paidOutAt: null,
          reversedAt: null,
          appliedAt: null,
        },
        _sum: { referralAmountCents: true },
      }),
      prisma.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId },
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
          paidOutAt: null,
          reversedAt: null,
          appliedAt: null,
        },
        _sum: { referralAmountCents: true },
      }),
    ]);

  return {
    referredPhotographersCount,
    referredOrganizersCount,
    activePhotographersCount,
    activeOrganizersCount,
    photographerReferralEarningsCents:
      photographerEarningsAgg._sum.referralAmountCents ?? 0,
    organizerReferralEarningsCents: organizerEarningsAgg._sum.referralAmountCents ?? 0,
    photographerBalanceCents: photographerBalanceAgg._sum.referralAmountCents ?? 0,
    organizerBalanceCents: organizerBalanceAgg._sum.referralAmountCents ?? 0,
  };
}

export async function getTalkTitleByIdForAttributions(
  referrerUserId: number
): Promise<Record<number, string>> {
  const trainingAttributions = await prisma.referralAttribution.findMany({
    where: {
      referrerUserId,
      sourceType: "TRAINING",
      sourceEntityId: { not: null },
    },
    select: { sourceEntityId: true },
  });

  const trainingIds = [
    ...new Set(
      trainingAttributions
        .map((a) => a.sourceEntityId)
        .filter((id): id is number => id != null && id > 0)
    ),
  ];

  if (trainingIds.length === 0) return {};

  const talks = await prisma.talk.findMany({
    where: { id: { in: trainingIds } },
    select: { id: true, title: true },
  });

  return Object.fromEntries(talks.map((t) => [t.id, t.title]));
}
