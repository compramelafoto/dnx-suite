/**
 * Métricas de solo lectura para el panel admin de comisiones de organizadores (eventos).
 * No modifica estados ni pagos.
 */

import {
  EventOrganizerCommissionStatus,
  OrganizerCommissionWithdrawalStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function decimalToNumber(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const ACTIVE_COMMISSION = {
  status: { not: EventOrganizerCommissionStatus.CANCELLED },
} as const;

export type OrganizerCommissionFinancialDashboard = {
  commissions: {
    totalGenerated: number;
    totalPaid: number;
    pendingOwed: number;
    heldRetained: number;
    availableBalance: number;
    inWithdrawalPipeline: number;
    percentPaid: number;
    last30DaysGenerated: number;
    futurePotentialHeld: number;
  };
  withdrawals: {
    pendingCount: number;
    pendingAmount: number;
    approvedCount: number;
    approvedAmount: number;
    rejectedCount: number;
    rejectedAmount: number;
    paidCount: number;
    paidAmount: number;
    averagePaidWithdrawal: number;
  };
  charts: {
    commissionsByMonth: { month: string; label: string; amount: number }[];
    withdrawalsByMonth: { month: string; label: string; amount: number }[];
  };
  topOrganizersByPending: {
    organizerUserId: number;
    organizerName: string;
    organizerEmail: string;
    pendingAmount: number;
    totalGenerated: number;
    salesCount: number;
  }[];
};

export type OrganizerFinancialSnapshot = {
  organizerUserId: number;
  totalGenerated: number;
  totalPaid: number;
  pendingBalance: number;
  heldRetained: number;
  availableBalance: number;
  eventsCount: number;
  salesCount: number;
  averageCommission: number;
  lastWithdrawalAt: string | null;
};

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString("es-AR", { month: "short", year: "numeric", timeZone: "UTC" });
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

export async function getOrganizerCommissionFinancialDashboard(): Promise<OrganizerCommissionFinancialDashboard> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
  twelveMonthsAgo.setUTCDate(1);
  twelveMonthsAgo.setUTCHours(0, 0, 0, 0);

  const [
    statusGroups,
    last30Agg,
    withdrawalGroups,
    paidWithdrawalAgg,
    commissionsMonthlyRaw,
    withdrawalsMonthlyRaw,
    topPendingRaw,
  ] = await Promise.all([
    prisma.eventOrganizerCommission.groupBy({
      by: ["status"],
      where: ACTIVE_COMMISSION,
      _sum: { organizerCommissionAmount: true },
      _count: { _all: true },
    }),
    prisma.eventOrganizerCommission.aggregate({
      where: { ...ACTIVE_COMMISSION, createdAt: { gte: thirtyDaysAgo } },
      _sum: { organizerCommissionAmount: true },
    }),
    prisma.organizerCommissionWithdrawalRequest.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.organizerCommissionWithdrawalRequest.aggregate({
      where: { status: OrganizerCommissionWithdrawalStatus.PAID },
      _avg: { amount: true },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ month: Date; amount: Prisma.Decimal }[]>`
      SELECT date_trunc('month', "createdAt") AS month,
             COALESCE(SUM("organizerCommissionAmount"), 0) AS amount
      FROM "EventOrganizerCommission"
      WHERE status <> 'CANCELLED'
        AND "createdAt" >= ${twelveMonthsAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<{ month: Date; amount: Prisma.Decimal }[]>`
      SELECT date_trunc('month', "requestedAt") AS month,
             COALESCE(SUM(amount), 0) AS amount
      FROM "OrganizerCommissionWithdrawalRequest"
      WHERE status = 'PAID'
        AND "requestedAt" >= ${twelveMonthsAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<
      {
        organizerUserId: number;
        pendingAmount: Prisma.Decimal;
        totalGenerated: Prisma.Decimal;
        salesCount: bigint;
      }[]
    >`
      SELECT c."organizerUserId" AS "organizerUserId",
             COALESCE(SUM(CASE WHEN c.status IN ('PENDING', 'AVAILABLE', 'WITHDRAWAL_REQUESTED')
               THEN c."organizerCommissionAmount" ELSE 0 END), 0) AS "pendingAmount",
             COALESCE(SUM(c."organizerCommissionAmount"), 0) AS "totalGenerated",
             COUNT(*)::bigint AS "salesCount"
      FROM "EventOrganizerCommission" c
      WHERE c.status <> 'CANCELLED'
      GROUP BY c."organizerUserId"
      HAVING SUM(CASE WHEN c.status IN ('PENDING', 'AVAILABLE', 'WITHDRAWAL_REQUESTED')
        THEN c."organizerCommissionAmount" ELSE 0 END) > 0
      ORDER BY "pendingAmount" DESC
      LIMIT 8
    `,
  ]);

  const sumByStatus = (s: EventOrganizerCommissionStatus) =>
    decimalToNumber(
      statusGroups.find((g) => g.status === s)?._sum.organizerCommissionAmount
    );

  const totalGenerated = statusGroups.reduce(
    (acc, g) => acc + decimalToNumber(g._sum.organizerCommissionAmount),
    0
  );
  const totalPaid = sumByStatus(EventOrganizerCommissionStatus.PAID);
  const heldRetained = sumByStatus(EventOrganizerCommissionStatus.PENDING);
  const availableBalance = sumByStatus(EventOrganizerCommissionStatus.AVAILABLE);
  const inWithdrawalPipeline = sumByStatus(EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED);
  const pendingOwed = heldRetained + availableBalance + inWithdrawalPipeline;
  const percentPaid = totalGenerated > 0 ? Math.round((totalPaid / totalGenerated) * 1000) / 10 : 0;
  const last30DaysGenerated = decimalToNumber(last30Agg._sum.organizerCommissionAmount);

  const w = (status: OrganizerCommissionWithdrawalStatus) => {
    const row = withdrawalGroups.find((g) => g.status === status);
    return {
      count: row?._count._all ?? 0,
      amount: decimalToNumber(row?._sum.amount),
    };
  };

  const requested = w(OrganizerCommissionWithdrawalStatus.REQUESTED);
  const approved = w(OrganizerCommissionWithdrawalStatus.APPROVED);
  const rejected = w(OrganizerCommissionWithdrawalStatus.REJECTED);
  const paidW = w(OrganizerCommissionWithdrawalStatus.PAID);

  const monthKeys = lastNMonthKeys(12);
  const commissionsMap = new Map<string, number>();
  const withdrawalsMap = new Map<string, number>();
  for (const row of commissionsMonthlyRaw) {
    commissionsMap.set(monthKey(new Date(row.month)), decimalToNumber(row.amount));
  }
  for (const row of withdrawalsMonthlyRaw) {
    withdrawalsMap.set(monthKey(new Date(row.month)), decimalToNumber(row.amount));
  }

  const organizerIds = topPendingRaw.map((r) => r.organizerUserId);
  const organizers =
    organizerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: organizerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const orgLabel = (id: number) => {
    const u = organizers.find((o) => o.id === id);
    if (!u) return { name: `Organizador #${id}`, email: "" };
    const n = (u.name || "").trim();
    return { name: n || u.email, email: u.email };
  };

  return {
    commissions: {
      totalGenerated,
      totalPaid,
      pendingOwed,
      heldRetained,
      availableBalance,
      inWithdrawalPipeline,
      percentPaid,
      last30DaysGenerated,
      futurePotentialHeld: heldRetained,
    },
    withdrawals: {
      pendingCount: requested.count,
      pendingAmount: requested.amount,
      approvedCount: approved.count,
      approvedAmount: approved.amount,
      rejectedCount: rejected.count,
      rejectedAmount: rejected.amount,
      paidCount: paidW.count || paidWithdrawalAgg._count._all,
      paidAmount: paidW.amount || decimalToNumber(paidWithdrawalAgg._sum.amount),
      averagePaidWithdrawal: decimalToNumber(paidWithdrawalAgg._avg.amount),
    },
    charts: {
      commissionsByMonth: monthKeys.map((k) => ({
        month: k,
        label: monthLabel(k),
        amount: commissionsMap.get(k) ?? 0,
      })),
      withdrawalsByMonth: monthKeys.map((k) => ({
        month: k,
        label: monthLabel(k),
        amount: withdrawalsMap.get(k) ?? 0,
      })),
    },
    topOrganizersByPending: topPendingRaw.map((r) => {
      const { name, email } = orgLabel(r.organizerUserId);
      return {
        organizerUserId: r.organizerUserId,
        organizerName: name,
        organizerEmail: email,
        pendingAmount: decimalToNumber(r.pendingAmount),
        totalGenerated: decimalToNumber(r.totalGenerated),
        salesCount: Number(r.salesCount),
      };
    }),
  };
}

export async function getOrganizerFinancialSnapshot(
  organizerUserId: number
): Promise<OrganizerFinancialSnapshot> {
  const [statusGroups, eventsCount, lastWithdrawal] = await Promise.all([
    prisma.eventOrganizerCommission.groupBy({
      by: ["status"],
      where: { organizerUserId, ...ACTIVE_COMMISSION },
      _sum: { organizerCommissionAmount: true },
      _count: { _all: true },
    }),
    prisma.eventOrganizerCommission.groupBy({
      by: ["eventId"],
      where: { organizerUserId, ...ACTIVE_COMMISSION },
    }),
    prisma.organizerCommissionWithdrawalRequest.findFirst({
      where: {
        organizerUserId,
        status: OrganizerCommissionWithdrawalStatus.PAID,
      },
      orderBy: { reviewedAt: "desc" },
      select: { reviewedAt: true },
    }),
  ]);

  const sumStatus = (s: EventOrganizerCommissionStatus) =>
    decimalToNumber(
      statusGroups.find((g) => g.status === s)?._sum.organizerCommissionAmount
    );

  const totalGenerated = statusGroups.reduce(
    (acc, g) => acc + decimalToNumber(g._sum.organizerCommissionAmount),
    0
  );
  const totalPaid = sumStatus(EventOrganizerCommissionStatus.PAID);
  const heldRetained = sumStatus(EventOrganizerCommissionStatus.PENDING);
  const availableBalance = sumStatus(EventOrganizerCommissionStatus.AVAILABLE);
  const inPipeline = sumStatus(EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED);
  const pendingBalance = heldRetained + availableBalance + inPipeline;
  const salesCount = statusGroups.reduce((acc, g) => acc + g._count._all, 0);
  const averageCommission = salesCount > 0 ? totalGenerated / salesCount : 0;

  return {
    organizerUserId,
    totalGenerated,
    totalPaid,
    pendingBalance,
    heldRetained,
    availableBalance,
    eventsCount: eventsCount.length,
    salesCount,
    averageCommission,
    lastWithdrawalAt: lastWithdrawal?.reviewedAt?.toISOString() ?? null,
  };
}

export async function getOrganizerFinancialSnapshots(
  organizerUserIds: number[]
): Promise<Map<number, OrganizerFinancialSnapshot>> {
  const map = new Map<number, OrganizerFinancialSnapshot>();
  if (organizerUserIds.length === 0) return map;

  const unique = [...new Set(organizerUserIds)];

  const [groups, eventCounts, lastPaid] = await Promise.all([
    prisma.eventOrganizerCommission.groupBy({
      by: ["organizerUserId", "status"],
      where: { organizerUserId: { in: unique }, ...ACTIVE_COMMISSION },
      _sum: { organizerCommissionAmount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ organizerUserId: number; eventsCount: bigint }[]>`
      SELECT "organizerUserId", COUNT(DISTINCT "eventId")::bigint AS "eventsCount"
      FROM "EventOrganizerCommission"
      WHERE "organizerUserId" IN (${Prisma.join(unique)})
        AND status <> 'CANCELLED'
      GROUP BY "organizerUserId"
    `,
    prisma.$queryRaw<{ organizerUserId: number; lastAt: Date | null }[]>`
      SELECT "organizerUserId", MAX("reviewedAt") AS "lastAt"
      FROM "OrganizerCommissionWithdrawalRequest"
      WHERE "organizerUserId" IN (${Prisma.join(unique)})
        AND status = 'PAID'
      GROUP BY "organizerUserId"
    `,
  ]);

  const eventsMap = new Map(eventCounts.map((r) => [r.organizerUserId, Number(r.eventsCount)]));
  const lastMap = new Map(lastPaid.map((r) => [r.organizerUserId, r.lastAt]));

  for (const oid of unique) {
    const rows = groups.filter((g) => g.organizerUserId === oid);
    const sumStatus = (s: EventOrganizerCommissionStatus) =>
      decimalToNumber(rows.find((g) => g.status === s)?._sum.organizerCommissionAmount);
    const totalGenerated = rows.reduce(
      (acc, g) => acc + decimalToNumber(g._sum.organizerCommissionAmount),
      0
    );
    const totalPaid = sumStatus(EventOrganizerCommissionStatus.PAID);
    const heldRetained = sumStatus(EventOrganizerCommissionStatus.PENDING);
    const availableBalance = sumStatus(EventOrganizerCommissionStatus.AVAILABLE);
    const inPipeline = sumStatus(EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED);
    const pendingBalance = heldRetained + availableBalance + inPipeline;
    const salesCount = rows.reduce((acc, g) => acc + g._count._all, 0);

    map.set(oid, {
      organizerUserId: oid,
      totalGenerated,
      totalPaid,
      pendingBalance,
      heldRetained,
      availableBalance,
      eventsCount: eventsMap.get(oid) ?? 0,
      salesCount,
      averageCommission: salesCount > 0 ? totalGenerated / salesCount : 0,
      lastWithdrawalAt: lastMap.get(oid)?.toISOString() ?? null,
    });
  }

  return map;
}
