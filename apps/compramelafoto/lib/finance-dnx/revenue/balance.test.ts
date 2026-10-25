import assert from "node:assert/strict";
import test from "node:test";

import { buildBalance } from "./balance";

test("el balance de cada mes es ingresos netos menos gastos pagados, con acumulado", () => {
  const b = buildBalance({
    months: [
      { periodYear: 2026, periodMonth: 1 },
      { periodYear: 2026, periodMonth: 2 },
    ],
    revenue: [
      { platformKey: "clf", periodYear: 2026, periodMonth: 1, netArs: 1000 },
      { platformKey: "fotoffice", periodYear: 2026, periodMonth: 1, netArs: 200 },
      { platformKey: "clf", periodYear: 2026, periodMonth: 2, netArs: 500 },
    ],
    expenses: [
      { periodYear: 2026, periodMonth: 1, paidArs: 700, byPlatform: { clf: 600, suite: 100 } },
      { periodYear: 2026, periodMonth: 2, paidArs: 900, byPlatform: { clf: 900 } },
    ],
  });
  assert.deepEqual(
    b.rows.map((r) => [r.periodMonth, r.revenueArs, r.expensesArs, r.resultArs, r.accumulatedArs]),
    [
      [1, 1200, 700, 500, 500],
      [2, 500, 900, -400, 100],
    ],
  );
  assert.deepEqual(b.rows[0].byPlatform.clf, { revenueArs: 1000, expensesArs: 600, resultArs: 400 });
  assert.deepEqual(b.rows[0].byPlatform.suite, { revenueArs: 0, expensesArs: 100, resultArs: -100 });
});

test("los totales suman todo el período", () => {
  const b = buildBalance({
    months: [{ periodYear: 2026, periodMonth: 1 }],
    revenue: [{ platformKey: "clf", periodYear: 2026, periodMonth: 1, netArs: 10 }],
    expenses: [],
  });
  assert.deepEqual([b.totals.revenueArs, b.totals.expensesArs, b.totals.resultArs], [10, 0, 10]);
  assert.deepEqual(b.totals.byPlatform.clf, { revenueArs: 10, expensesArs: 0, resultArs: 10 });
});
