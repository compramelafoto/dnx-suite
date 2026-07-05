import type { PrismaClient } from "@prisma/client";
import { excludeTestOrderWhere } from "@/lib/reporting/exclude-test-rows";

const TZ = "America/Argentina/Buenos_Aires";
const DEFAULT_DAYS = 90;

export type PhotographerSalesRankingRow = {
  rank: number;
  photographerId: number;
  name: string | null;
  email: string;
  totalAmount: number;
};

export type PhotographerWeeklySalesRow = {
  weekStart: string;
  weekLabel: string;
  albumAmount: number;
  printAmount: number;
  totalAmount: number;
};

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  };
  const startLabel = weekStart.toLocaleDateString("es-AR", fmt);
  const endLabel = end.toLocaleDateString("es-AR", fmt);
  return `${startLabel} – ${endLabel}`;
}

/** Fotógrafos con ventas PAID en los últimos N días, ordenados de mayor a menor facturación. */
export async function computePhotographerSalesRanking(
  prisma: PrismaClient,
  days = DEFAULT_DAYS
): Promise<PhotographerSalesRankingRow[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const [albumBilling, printBilling] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...excludeTestOrderWhere,
        status: "PAID",
        createdAt: { gte: cutoff },
      },
      select: {
        totalCents: true,
        album: { select: { userId: true } },
      },
    }),
    prisma.printOrder.findMany({
      where: {
        paymentStatus: "PAID",
        photographerId: { not: null },
        createdAt: { gte: cutoff },
      },
      select: {
        total: true,
        photographerId: true,
      },
    }),
  ]);

  const billingByUser = new Map<number, number>();
  albumBilling.forEach((o) => {
    const uid = o.album?.userId;
    if (uid) {
      billingByUser.set(uid, (billingByUser.get(uid) || 0) + (o.totalCents || 0));
    }
  });
  printBilling.forEach((o) => {
    const uid = o.photographerId;
    if (uid) {
      billingByUser.set(uid, (billingByUser.get(uid) || 0) + (o.total || 0));
    }
  });

  const sorted = Array.from(billingByUser.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return [];

  const userIds = sorted.map(([uid]) => uid);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  return sorted.map(([uid, total], index) => {
    const user = users.find((u) => u.id === uid);
    return {
      rank: index + 1,
      photographerId: uid,
      name: user?.name ?? null,
      email: user?.email ?? "—",
      totalAmount: Math.round(total),
    };
  });
}

/** Ventas semanales en ARS de un fotógrafo (álbumes + impresiones), últimos N días. */
export async function computePhotographerWeeklySales(
  prisma: PrismaClient,
  photographerId: number,
  days = DEFAULT_DAYS
): Promise<PhotographerWeeklySalesRow[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const rows = await prisma.$queryRaw<
    Array<{
      week_start: Date;
      album_amount: number;
      print_amount: number;
      total_amount: number;
    }>
  >`
    WITH week_series AS (
      SELECT generate_series(
        date_trunc(
          'week',
          timezone(${TZ}, ${cutoff}::timestamptz)
        ),
        date_trunc(
          'week',
          timezone(${TZ}, now())
        ),
        '1 week'::interval
      ) AS week_start
    ),
    album_sales AS (
      SELECT
        date_trunc('week', timezone(${TZ}, o."createdAt")) AS week_start,
        COALESCE(SUM(o."totalCents"), 0)::int AS amount
      FROM "Order" o
      INNER JOIN "Album" a ON a."id" = o."albumId"
      WHERE o."status" = 'PAID'
        AND o."isTest" = false
        AND a."userId" = ${photographerId}
        AND o."createdAt" >= ${cutoff}
      GROUP BY 1
    ),
    print_sales AS (
      SELECT
        date_trunc('week', timezone(${TZ}, po."createdAt")) AS week_start,
        COALESCE(SUM(po."total"), 0)::int AS amount
      FROM "PrintOrder" po
      WHERE po."paymentStatus" = 'PAID'
        AND po."photographerId" = ${photographerId}
        AND po."createdAt" >= ${cutoff}
      GROUP BY 1
    )
    SELECT
      ws.week_start,
      COALESCE(a.amount, 0)::int AS album_amount,
      COALESCE(p.amount, 0)::int AS print_amount,
      (COALESCE(a.amount, 0) + COALESCE(p.amount, 0))::int AS total_amount
    FROM week_series ws
    LEFT JOIN album_sales a ON a.week_start = ws.week_start
    LEFT JOIN print_sales p ON p.week_start = ws.week_start
    ORDER BY ws.week_start ASC
  `;

  return rows.map((row) => {
    const weekStart =
      row.week_start instanceof Date ? row.week_start : new Date(row.week_start);
    return {
      weekStart: weekStart.toISOString(),
      weekLabel: formatWeekLabel(weekStart),
      albumAmount: Number(row.album_amount),
      printAmount: Number(row.print_amount),
      totalAmount: Number(row.total_amount),
    };
  });
}
