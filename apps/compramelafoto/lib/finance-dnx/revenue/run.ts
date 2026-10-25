import { prisma } from "@/lib/prisma";

import { computeClf, computeFotoffice, computeFotorank, computeSubilafoto, monthKey, monthKeysSince, type MonthRevenue } from "./compute";
import { REVENUE_SINCE, loadClfRows, loadFotofficeRows, loadFotorankRows, loadSubilafotoRows } from "./sources";

export type RevenuePlatformResult = { platformKey: string; ok: boolean; error: string | null };

type Source = { platformKey: string; load: () => Promise<{ months: Map<string, MonthRevenue>; note: string }> };

/** Plataformas que cuentan como ingreso (Clickatón e InfoSpot fuera, decisión de Daniel 18/10/2026). */
export const REVENUE_PLATFORMS = ["clf", "subilafoto", "fotoffice", "fotorank"] as const;

const SOURCES: Source[] = [
  {
    platformKey: "clf",
    load: async () => ({
      months: computeClf(await loadClfRows()),
      note: "Comisión de órdenes e impresiones pagas, menos descuento y parte de referidos.",
    }),
  },
  {
    platformKey: "subilafoto",
    load: async () => ({ months: computeSubilafoto(await loadSubilafotoRows()), note: "Comisión de ventas pagas sin reembolso." }),
  },
  {
    platformKey: "fotoffice",
    load: async () => {
      const rows = await loadFotofficeRows();
      const debt = rows.pendingFeeDebtArs.toLocaleString("es-AR", { maximumFractionDigits: 2 });
      return {
        months: computeFotoffice(rows),
        note: `Comisión cobrada por Mercado Pago (incluye pedidos de Digitalización) y saldada a mano. Comisión adeudada por cobros en efectivo: ${debt} pesos.`,
      };
    },
  },
  {
    platformKey: "fotorank",
    load: async () => ({
      months: computeFotorank(await loadFotorankRows()),
      note: "Comisión de DNX sobre inscripciones pagas, menos comisión de Mercado Pago estimada.",
    }),
  },
];

const EMPTY: MonthRevenue = { grossArs: 0, processorFeeArs: 0, payoutToThirdPartiesArs: 0, netArs: 0, operationsCount: 0 };

/**
 * Recalcula los ingresos de todos los meses desde 01/2026 y los guarda. Si una base falla, esa
 * plataforma conserva el último cálculo guardado y el error se informa.
 */
export async function recomputeRevenue(now = new Date()): Promise<RevenuePlatformResult[]> {
  const months = monthKeysSince(REVENUE_SINCE, now);
  const results: RevenuePlatformResult[] = [];
  for (const source of SOURCES) {
    try {
      const { months: data, note } = await source.load();
      await prisma.$transaction(
        months.map(({ periodYear, periodMonth }) => {
          const m = data.get(monthKey(periodYear, periodMonth)) ?? EMPTY;
          const values = { ...m, computedAt: now, sourceNote: note };
          return prisma.platformRevenueSnapshot.upsert({
            where: { platformKey_periodYear_periodMonth: { platformKey: source.platformKey, periodYear, periodMonth } },
            create: { platformKey: source.platformKey, periodYear, periodMonth, ...values },
            update: values,
          });
        }),
      );
      results.push({ platformKey: source.platformKey, ok: true, error: null });
    } catch (err) {
      console.error(`[finance-dnx/revenue] ${source.platformKey}`, err);
      results.push({ platformKey: source.platformKey, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
