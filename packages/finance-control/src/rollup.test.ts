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

test("un reembolso parcial se descuenta de lo pagado, pero no de lo facturado", () => {
  // Caso real del relevamiento: se cobraron 100 y se reembolsaron 66.81, o
  // sea que neto de la cuenta salieron 33.19.
  const resumen = buildMonthlySummary([
    {
      vendorKey: "vendor-con-reembolso",
      amountArsMinor: 100_00,
      amountRefundedMinor: 66_81,
      status: "PAGADO" as const,
      allocations: [],
    },
  ]);

  assert.equal(resumen.paidArsMinor, 33_19);
  assert.equal(resumen.billedArsMinor, 100_00);
});

test("una entrada sin amountRefundedMinor se comporta exactamente igual que antes", () => {
  const resumen = buildMonthlySummary([gastoDirecto]);

  assert.equal(resumen.paidArsMinor, 20_00);
  assert.equal(resumen.billedArsMinor, 20_00);
});

test("un gasto impago se cuenta como deuda, igual que uno rechazado", () => {
  // RECHAZADO e IMPAGO comparten el mismo camino de código a través de
  // ESTADOS_DE_DEUDA. Si alguien borrara "IMPAGO" del Set, esta prueba
  // tiene que detectarlo (esta prueba sola, sin la de RECHAZADO, ya lo hace).
  const resumen = buildMonthlySummary([{ ...gastoDirecto, status: "IMPAGO" as const }]);

  assert.equal(resumen.debtArsMinor, 20_00);
  assert.equal(resumen.paidArsMinor, 0);
});

test("un gasto reembolsado (REEMBOLSADO) cuenta como facturado pero ni como pagado ni como deuda", () => {
  const resumen = buildMonthlySummary([{ ...gastoDirecto, status: "REEMBOLSADO" as const }]);

  assert.equal(resumen.billedArsMinor, 20_00);
  assert.equal(resumen.paidArsMinor, 0);
  assert.equal(resumen.debtArsMinor, 0);
});
