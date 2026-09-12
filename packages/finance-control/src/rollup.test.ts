import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthlySummary } from "./rollup";

const gastoCompartido = {
  vendorKey: "vercel",
  amountArsMinor: 100_00,
  status: "PAGADO" as const,
  allocations: [
    { platformKey: "clf", sharePercent: 60, amountArsMinor: 60_00 },
    { platformKey: "fotoffice", sharePercent: 40, amountArsMinor: 40_00 },
  ],
};

const gastoDirecto = {
  vendorKey: "dominio-clf",
  amountArsMinor: 20_00,
  status: "PAGADO" as const,
  allocations: [{ platformKey: "clf", sharePercent: 100, amountArsMinor: 20_00 }],
};

test("lo facturado suma todos los gastos del mes", () => {
  const resumen = buildMonthlySummary([gastoCompartido, gastoDirecto]);

  assert.equal(resumen.billedArsMinor, 120_00);
});

test("una factura rechazada se cuenta como deuda, no como pagada", () => {
  const resumen = buildMonthlySummary([
    { ...gastoDirecto, status: "RECHAZADO" as const },
  ]);

  assert.equal(resumen.billedArsMinor, 20_00);
  assert.equal(resumen.paidArsMinor, 0);
  assert.equal(resumen.debtArsMinor, 20_00);
});

test("separa el gasto directo del prorrateado", () => {
  const resumen = buildMonthlySummary([gastoCompartido, gastoDirecto]);
  const clf = resumen.byPlatform.find((p) => p.platformKey === "clf");

  assert.equal(clf?.directArsMinor, 20_00);
  assert.equal(clf?.proratedArsMinor, 60_00);
  assert.equal(clf?.totalArsMinor, 80_00);
});

test("un mes sin gastos devuelve todo en cero y sin plataformas", () => {
  const resumen = buildMonthlySummary([]);

  assert.equal(resumen.billedArsMinor, 0);
  assert.equal(resumen.paidArsMinor, 0);
  assert.equal(resumen.debtArsMinor, 0);
  assert.deepEqual(resumen.byPlatform, []);
});
