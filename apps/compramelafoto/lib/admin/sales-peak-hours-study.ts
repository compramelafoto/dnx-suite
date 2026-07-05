import type { PrismaClient } from "@prisma/client";
import { excludeTestOrderWhere } from "@/lib/reporting/exclude-test-rows";

const TZ = "America/Argentina/Buenos_Aires";
const PERIOD_DAYS = 90;

const DOW_LABELS_MON_FIRST = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const WEEKDAY_TO_MON0: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type SalesPeakBucketRow = {
  orderCount: number;
  revenue: number;
};

export type SalesPeakDayRow = SalesPeakBucketRow & {
  dayIndex: number;
  label: string;
};

export type SalesPeakHourRow = SalesPeakBucketRow & {
  hour: number;
  label: string;
};

export type SalesPeakHighlight = {
  label: string;
  orderCount: number;
  revenue: number;
};

export type SalesPeakHoursStudy = {
  periodDays: number;
  rangeStartLabel: string;
  rangeEndLabel: string;
  totalOrders: number;
  totalRevenue: number;
  byDayOfWeek: SalesPeakDayRow[];
  byHour: SalesPeakHourRow[];
  peakDay: SalesPeakHighlight;
  quietDay: SalesPeakHighlight;
  peakHour: SalesPeakHighlight & { hour: number };
  quietHour: SalesPeakHighlight & { hour: number };
};

function arTodayStartUtc(now: Date): Date {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
}

function arLocalDowAndHour(d: Date): { dowMon0: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { dowMon0: WEEKDAY_TO_MON0[wd] ?? 0, hour: Math.min(23, Math.max(0, hour)) };
}

function formatDateLabelAR(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pickPeakQuiet<T extends SalesPeakBucketRow & { label: string }>(
  rows: T[],
  tieBreak: (a: T, b: T) => T
): { peak: SalesPeakHighlight; quiet: SalesPeakHighlight } {
  if (rows.length === 0) {
    const empty = { label: "—", orderCount: 0, revenue: 0 };
    return { peak: empty, quiet: empty };
  }
  let peak = rows[0];
  let quiet = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.orderCount > peak.orderCount || (r.orderCount === peak.orderCount && tieBreak(r, peak) === r)) {
      peak = r;
    }
    if (r.orderCount < quiet.orderCount || (r.orderCount === quiet.orderCount && tieBreak(quiet, r) === quiet)) {
      quiet = r;
    }
  }
  return {
    peak: { label: peak.label, orderCount: peak.orderCount, revenue: peak.revenue },
    quiet: { label: quiet.label, orderCount: quiet.orderCount, revenue: quiet.revenue },
  };
}

function recordSale(
  createdAt: Date,
  revenue: number,
  byDow: SalesPeakBucketRow[],
  byHour: SalesPeakBucketRow[]
) {
  const { dowMon0, hour } = arLocalDowAndHour(createdAt);
  byDow[dowMon0].orderCount += 1;
  byDow[dowMon0].revenue += revenue;
  byHour[hour].orderCount += 1;
  byHour[hour].revenue += revenue;
}

/**
 * Distribución de ventas confirmadas (PAID) por día de la semana y hora del día (AR),
 * en una ventana móvil de los últimos `periodDays` días desde el inicio del día actual en Argentina.
 */
export async function computeSalesPeakHoursStudy(
  prisma: PrismaClient,
  periodDays: number = PERIOD_DAYS
): Promise<SalesPeakHoursStudy> {
  const now = new Date();
  const todayStart = arTodayStartUtc(now);
  const rangeStart = new Date(todayStart);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - periodDays);

  const [paidPrintOrders, paidAlbumOrders] = await Promise.all([
    prisma.printOrder.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: rangeStart } },
      select: { createdAt: true, total: true },
    }),
    prisma.order.findMany({
      where: { ...excludeTestOrderWhere, status: "PAID", createdAt: { gte: rangeStart } },
      select: { createdAt: true, totalCents: true },
    }),
  ]);

  const byDow: SalesPeakBucketRow[] = Array.from({ length: 7 }, () => ({ orderCount: 0, revenue: 0 }));
  const byHour: SalesPeakBucketRow[] = Array.from({ length: 24 }, () => ({ orderCount: 0, revenue: 0 }));

  for (const o of paidPrintOrders) {
    recordSale(o.createdAt, o.total ?? 0, byDow, byHour);
  }
  for (const o of paidAlbumOrders) {
    recordSale(o.createdAt, o.totalCents ?? 0, byDow, byHour);
  }

  const byDayOfWeek: SalesPeakDayRow[] = DOW_LABELS_MON_FIRST.map((label, dayIndex) => ({
    dayIndex,
    label,
    ...byDow[dayIndex],
  }));

  const byHourRows: SalesPeakHourRow[] = byHour.map((b, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    ...b,
  }));

  const { peak: peakDay, quiet: quietDay } = pickPeakQuiet(byDayOfWeek, (a, b) =>
    a.revenue >= b.revenue ? a : b
  );
  const { peak: peakHourBase, quiet: quietHourBase } = pickPeakQuiet(byHourRows, (a, b) =>
    a.revenue >= b.revenue ? a : b
  );

  const peakHourRow = byHourRows.find((r) => r.label === peakHourBase.label) ?? byHourRows[0];
  const quietHourRow = byHourRows.find((r) => r.label === quietHourBase.label) ?? byHourRows[0];

  let totalOrders = 0;
  let totalRevenue = 0;
  for (const b of byDow) {
    totalOrders += b.orderCount;
    totalRevenue += b.revenue;
  }

  return {
    periodDays,
    rangeStartLabel: formatDateLabelAR(rangeStart),
    rangeEndLabel: formatDateLabelAR(now),
    totalOrders,
    totalRevenue,
    byDayOfWeek,
    byHour: byHourRows,
    peakDay,
    quietDay,
    peakHour: { ...peakHourBase, hour: peakHourRow?.hour ?? 0 },
    quietHour: { ...quietHourBase, hour: quietHourRow?.hour ?? 0 },
  };
}
