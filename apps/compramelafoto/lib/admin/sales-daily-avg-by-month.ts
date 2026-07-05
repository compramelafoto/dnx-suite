import type { PrismaClient, PrintOrderType } from "@prisma/client";
import { excludeTestOrderWhere } from "@/lib/reporting/exclude-test-rows";

const TZ = "America/Argentina/Buenos_Aires";

export type SalesDailyAvgMonthRow = {
  monthKey: string;
  monthLabel: string;
  /** Días usados como divisor (mes cerrado = días calendario; mes actual = días + fracción del día en curso AR) */
  daysInMonth: number;
  calendarDaysInMonth: number;
  isCurrentMonth: boolean;
  digitalDailyAvg: number;
  printDailyAvg: number;
  totalDailyAvg: number;
};

function yearMonthKeyAR(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

function daysInCalendarMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function dayOfMonthAR(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    day: "numeric",
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === "day")!.value);
}

/** Fracción del día calendario ya transcurrida en AR (0 al inicio del día, →1 al final). */
function fractionOfDayElapsedAR(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);
  let hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  const second = Number(parts.find((p) => p.type === "second")!.value);
  if (hour === 24) hour = 0;
  const secondsSinceMidnight = hour * 3600 + minute * 60 + second;
  return secondsSinceMidnight / 86_400;
}

/**
 * Divisor del promedio diario.
 * Mes cerrado: días calendario del mes.
 * Mes en curso (AR): días completos anteriores + fracción del día en curso según horas transcurridas,
 * para que al iniciar un día nuevo el promedio no caiga por dividir ventas en $0 entre un día entero extra.
 */
export function daysForDailyAverage(year: number, month1to12: number, now: Date): number {
  const key = `${year}-${String(month1to12).padStart(2, "0")}`;
  if (key === yearMonthKeyAR(now)) {
    const day = dayOfMonthAR(now);
    const dayFraction = fractionOfDayElapsedAR(now);
    const effectiveDays = day - 1 + dayFraction;
    return Math.max(effectiveDays, 1 / 1_440);
  }
  return daysInCalendarMonth(year, month1to12);
}

/** Últimos `monthsBack` meses calendario (hasta el mes corriente en AR), del más antiguo al más reciente. */
function monthWindowDescriptors(monthsBack: number, now: Date): { key: string; year: number; month: number }[] {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric" }).formatToParts(
    now
  );
  const cy = Number(parts.find((p) => p.type === "year")!.value);
  const cm = Number(parts.find((p) => p.type === "month")!.value);
  const out: { key: string; year: number; month: number }[] = [];
  for (let k = monthsBack - 1; k >= 0; k--) {
    let m = cm - k;
    let y = cy;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    out.push({ key: `${y}-${String(m).padStart(2, "0")}`, year: y, month: m });
  }
  return out;
}

function addPrintOrderToBucket(orderType: PrintOrderType, total: number, b: { digital: number; print: number }) {
  if (orderType === "DIGITAL") {
    b.digital += total;
    return;
  }
  if (orderType === "PRINT") {
    b.print += total;
    return;
  }
  const half = Math.floor(total / 2);
  b.digital += half;
  b.print += total - half;
}

/**
 * Promedio diario de ventas confirmadas (PAID) por mes, separando ingreso atribuido a digital vs impreso.
 * Incluye PrintOrder + Order de álbum (líneas por ítem).
 */
export async function computeSalesDailyAvgByMonth(
  prisma: PrismaClient,
  monthsBack: number = 12
): Promise<SalesDailyAvgMonthRow[]> {
  const now = new Date();
  const windowDesc = monthWindowDescriptors(monthsBack, now);
  const oldest = windowDesc[0];
  const rangeStart = new Date(Date.UTC(oldest.year, oldest.month - 1, 1, 3, 0, 0, 0));

  const [paidPrintOrders, paidAlbumOrders] = await Promise.all([
    prisma.printOrder.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: rangeStart } },
      select: { createdAt: true, total: true, orderType: true },
    }),
    prisma.order.findMany({
      where: { ...excludeTestOrderWhere, status: "PAID", createdAt: { gte: rangeStart } },
      select: {
        createdAt: true,
        items: { select: { subtotalCents: true, productType: true } },
      },
    }),
  ]);

  const bucket = new Map<string, { digital: number; print: number }>();
  for (const w of windowDesc) {
    bucket.set(w.key, { digital: 0, print: 0 });
  }

  for (const o of paidPrintOrders) {
    const key = yearMonthKeyAR(o.createdAt);
    const b = bucket.get(key);
    if (!b) continue;
    const total = o.total ?? 0;
    addPrintOrderToBucket(o.orderType, total, b);
  }

  for (const o of paidAlbumOrders) {
    const key = yearMonthKeyAR(o.createdAt);
    const b = bucket.get(key);
    if (!b) continue;
    for (const it of o.items) {
      const line = it.subtotalCents ?? 0;
      const pt = it.productType;
      if (pt === "PRINT" || pt === "FRAME") {
        b.print += line;
      } else {
        b.digital += line;
      }
    }
  }

  const currentMonthKey = yearMonthKeyAR(now);

  return windowDesc.map(({ key, year, month }) => {
    const { digital, print } = bucket.get(key) ?? { digital: 0, print: 0 };
    const calendarDaysInMonth = daysInCalendarMonth(year, month);
    const daysInMonth = daysForDailyAverage(year, month, now);
    const isCurrentMonth = key === currentMonthKey;
    const total = digital + print;
    return {
      monthKey: key,
      monthLabel: new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "numeric" }),
      daysInMonth,
      calendarDaysInMonth,
      isCurrentMonth,
      digitalDailyAvg: daysInMonth > 0 ? Math.round(digital / daysInMonth) : 0,
      printDailyAvg: daysInMonth > 0 ? Math.round(print / daysInMonth) : 0,
      totalDailyAvg: daysInMonth > 0 ? Math.round(total / daysInMonth) : 0,
    };
  });
}
