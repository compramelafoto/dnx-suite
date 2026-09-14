/**
 * Adaptador Prisma del puerto de Finanzas DNX.
 *
 * No vuelve a decidir nada que ya esté decidido en `lib/finance-dnx`: usa
 * `isOverdueUnpaid`/`daysOverdue` para "vencida e impaga" (el bug de Neon que
 * pasó cuatro meses sin verse), `findVendorsMissingThisPeriod` para "qué
 * proveedor no cargó nada este mes" y `shouldNagAboutMissingExpenses` para
 * desde cuándo tiene sentido reclamarlo. Escribir de nuevo cualquiera de
 * estas decisiones acá sería exactamente la duplicación que este proyecto
 * viene sacando toda la semana.
 */
import type { PrismaClient } from "@prisma/client";
import { buildMonthlySummary, type ExpenseStatus, type SummaryEntry } from "@repo/finance-control";
import type {
  FinanceMissingVendorsCheck,
  FinanceMonthTotals,
  FinanceOverdueInvoice,
  FinancePort,
} from "@repo/ops-daily-report";

import { shouldNagAboutMissingExpenses } from "@/lib/finance-dnx/alerts";
import { daysOverdue, diaCalendarioArgentina, isOverdueUnpaid } from "@/lib/finance-dnx/due-date";
import { previousPeriod } from "@/lib/finance-dnx/expense-form";
import { findVendorsMissingThisPeriod } from "@/lib/finance-dnx/missing-vendors";

/** Año, mes y día calendario argentino de "ahora", en un solo lugar. */
function argentinaYearMonthDay(now: Date): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = diaCalendarioArgentina(now).split("-");
  return { year: Number(yearStr), month: Number(monthStr), day: Number(dayStr) };
}

export function createPrismaFinancePort(client: PrismaClient): FinancePort {
  return {
    async overdueInvoices(): Promise<FinanceOverdueInvoice[]> {
      const now = new Date();

      // Mismo filtro que usaba el cron dado de baja: candidatas a estar
      // vencidas son las rechazadas o impagas que tienen fecha de vencimiento.
      const candidatas = await client.expenseEntry.findMany({
        where: { status: { in: ["RECHAZADO", "IMPAGO"] }, dueDate: { not: null } },
        include: { vendor: true },
      });

      const overdue: FinanceOverdueInvoice[] = [];
      for (const entry of candidatas) {
        if (!entry.dueDate) continue;
        const status = entry.status as ExpenseStatus;
        if (!isOverdueUnpaid(entry.dueDate, status, now)) continue;

        overdue.push({
          vendorKey: entry.vendor.key,
          vendorName: entry.vendor.name,
          periodMonth: entry.periodMonth,
          status: status as "RECHAZADO" | "IMPAGO",
          amountArs: entry.amountArs.toNumber(),
          amountOriginal: entry.amountOriginal.toNumber(),
          currency: entry.currency as "USD" | "ARS",
          daysOverdue: daysOverdue(entry.dueDate, now),
          dueDate: entry.dueDate.toISOString(),
        });
      }

      return overdue;
    },

    async missingVendors(): Promise<FinanceMissingVendorsCheck> {
      const { year, month, day } = argentinaYearMonthDay(new Date());

      if (!shouldNagAboutMissingExpenses(day)) return null;

      // Misma función que usa la pantalla de resumen, para que el informe y
      // la pantalla nunca se contradigan sobre qué proveedor falta.
      const faltantes = await findVendorsMissingThisPeriod({ year, month });

      return {
        vendors: faltantes.map((vendor) => ({ vendorKey: vendor.key, vendorName: vendor.name })),
        period: previousPeriod(year, month),
      };
    },

    async monthTotals(): Promise<FinanceMonthTotals> {
      const { year, month } = argentinaYearMonthDay(new Date());

      const entries = await client.expenseEntry.findMany({
        where: { periodYear: year, periodMonth: month },
        include: { allocations: true, vendor: true },
      });

      const summaryEntries: SummaryEntry[] = entries.map((entry) => ({
        vendorKey: entry.vendor.key,
        amountArsMinor: Math.round(entry.amountArs.toNumber() * 100),
        amountRefundedMinor:
          entry.amountRefunded == null
            ? undefined
            : Math.round(entry.amountRefunded.toNumber() * 100),
        status: entry.status as ExpenseStatus,
        allocations: entry.allocations.map((parte) => ({
          platformKey: parte.platformKey,
          sharePercent: parte.sharePercent.toNumber(),
          amountArsMinor: Math.round(parte.amountArs.toNumber() * 100),
        })),
      }));

      const summary = buildMonthlySummary(summaryEntries);

      // Deuda acumulada de verdad: todas las facturas RECHAZADO o IMPAGO que
      // siguen abiertas, sin importar el mes (el resumen del mes sólo mira el
      // período pedido). Misma cuenta que usa la pantalla de resumen.
      const deudaAcumulada = await client.expenseEntry.aggregate({
        _sum: { amountArs: true },
        where: { status: { in: ["RECHAZADO", "IMPAGO"] } },
      });

      return {
        billedArs: summary.billedArsMinor / 100,
        paidArs: summary.paidArsMinor / 100,
        accumulatedDebtArs: deudaAcumulada._sum.amountArs?.toNumber() ?? 0,
      };
    },
  };
}
