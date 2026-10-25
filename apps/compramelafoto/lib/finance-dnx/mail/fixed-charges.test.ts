import assert from "node:assert/strict";
import test from "node:test";

import { missingFixedMonths, type FixedCharge } from "./fixed-charges";

const GPT: FixedCharge = { vendorKey: "chatgpt", amount: 20, currency: "USD", day: 29, since: { year: 2026, month: 9 }, note: "x" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

test("genera un cobro por mes desde el inicio, sin adelantarse al día de cobro", () => {
  const r = missingFixedMonths(GPT, [], new Date("2026-10-18T12:00:00Z"));
  assert.deepEqual(r.map((m) => [m.periodYear, m.periodMonth, iso(m.date)]), [[2026, 9, "2026-09-29"]]);
});

test("cuando llega el día de cobro, suma el mes actual", () => {
  const r = missingFixedMonths(GPT, [], new Date("2026-10-30T12:00:00Z"));
  assert.deepEqual(r.map((m) => m.periodMonth), [9, 10]);
});

test("no repite meses que ya tienen gasto", () => {
  const r = missingFixedMonths(GPT, [{ periodYear: 2026, periodMonth: 9 }], new Date("2026-10-30T12:00:00Z"));
  assert.deepEqual(r.map((m) => m.periodMonth), [10]);
});

test("en febrero el día 29 pasa al último día del mes", () => {
  const r = missingFixedMonths({ ...GPT, since: { year: 2027, month: 2 } }, [], new Date("2027-03-01T12:00:00Z"));
  assert.equal(iso(r[0].date), "2027-02-28");
});

test("cruza de año", () => {
  const r = missingFixedMonths({ ...GPT, day: 1, since: { year: 2026, month: 12 } }, [], new Date("2027-01-15T12:00:00Z"));
  assert.deepEqual(r.map((m) => [m.periodYear, m.periodMonth]), [[2026, 12], [2027, 1]]);
});
