export type PlatformResult = { revenueArs: number; expensesArs: number; resultArs: number };

export type BalanceRow = {
  periodYear: number;
  periodMonth: number;
  revenueArs: number;
  expensesArs: number;
  resultArs: number;
  accumulatedArs: number;
  byPlatform: Record<string, PlatformResult>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function addTo(map: Record<string, PlatformResult>, key: string, revenue: number, expenses: number) {
  const p = map[key] ?? { revenueArs: 0, expensesArs: 0, resultArs: 0 };
  p.revenueArs = r2(p.revenueArs + revenue);
  p.expensesArs = r2(p.expensesArs + expenses);
  p.resultArs = r2(p.revenueArs - p.expensesArs);
  map[key] = p;
}

/** Ingresos netos (por plataforma) contra gastos pagados (repartidos por plataforma), mes a mes. */
export function buildBalance(input: {
  months: { periodYear: number; periodMonth: number }[];
  revenue: { platformKey: string; periodYear: number; periodMonth: number; netArs: number }[];
  expenses: { periodYear: number; periodMonth: number; paidArs: number; byPlatform: Record<string, number> }[];
}): { rows: BalanceRow[]; totals: Omit<BalanceRow, "periodYear" | "periodMonth" | "accumulatedArs"> } {
  const totals = { revenueArs: 0, expensesArs: 0, resultArs: 0, byPlatform: {} as Record<string, PlatformResult> };
  let accumulated = 0;
  const rows = input.months.map(({ periodYear, periodMonth }) => {
    const same = <T extends { periodYear: number; periodMonth: number }>(x: T) => x.periodYear === periodYear && x.periodMonth === periodMonth;
    const byPlatform: Record<string, PlatformResult> = {};
    let revenue = 0;
    for (const r of input.revenue.filter(same)) {
      revenue += r.netArs;
      addTo(byPlatform, r.platformKey, r.netArs, 0);
      addTo(totals.byPlatform, r.platformKey, r.netArs, 0);
    }
    const exp = input.expenses.find(same);
    for (const [k, v] of Object.entries(exp?.byPlatform ?? {})) {
      addTo(byPlatform, k, 0, v);
      addTo(totals.byPlatform, k, 0, v);
    }
    const expenses = exp?.paidArs ?? 0;
    const result = r2(revenue - expenses);
    accumulated = r2(accumulated + result);
    totals.revenueArs = r2(totals.revenueArs + revenue);
    totals.expensesArs = r2(totals.expensesArs + expenses);
    totals.resultArs = r2(totals.revenueArs - totals.expensesArs);
    return { periodYear, periodMonth, revenueArs: r2(revenue), expensesArs: r2(expenses), resultArs: result, accumulatedArs: accumulated, byPlatform };
  });
  return { rows, totals };
}
