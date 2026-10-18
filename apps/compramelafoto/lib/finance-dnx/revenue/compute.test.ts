import assert from "node:assert/strict";
import test from "node:test";

import { FOTORANK_MP_FEE_ESTIMATE, computeClf, computeFotoffice, computeFotorank, computeSubilafoto, monthKeysSince } from "./compute";

const D = (s: string) => new Date(`${s}T15:00:00Z`);

test("los meses van desde el inicio hasta hoy, en hora argentina", () => {
  assert.deepEqual(monthKeysSince({ year: 2025, month: 11 }, new Date("2026-02-01T02:00:00Z")), [
    { periodYear: 2025, periodMonth: 11 },
    { periodYear: 2025, periodMonth: 12 },
    { periodYear: 2026, periodMonth: 1 },
  ]);
});

test("CLF: comisión de fotos e impresiones menos descuento y parte de los referidos", () => {
  const r = computeClf({
    orders: [
      { date: D("2026-03-10"), total: 10000, fee: 1500, referralDiscount: 100 },
      { date: D("2026-03-20"), total: 5000, fee: 750, referralDiscount: 0 },
    ],
    prints: [{ date: D("2026-03-05"), total: 2000, fee: 300 }],
    referrals: [{ date: D("2026-03-11"), amount: 700 }],
  });
  assert.deepEqual(r.get("2026-3"), {
    grossArs: 17000,
    processorFeeArs: 0,
    payoutToThirdPartiesArs: 800,
    netArs: 1750,
    operationsCount: 3,
  });
});

test("CLF: cada cosa va al mes en que pasó (hora argentina)", () => {
  const r = computeClf({
    // 01/04 01:00 UTC es todavía 31/03 en Argentina.
    orders: [{ date: new Date("2026-04-01T01:00:00Z"), total: 100, fee: 10, referralDiscount: 0 }],
    prints: [],
    referrals: [],
  });
  assert.equal(r.get("2026-3")?.netArs, 10);
  assert.equal(r.get("2026-4"), undefined);
});

test("SubiLaFoto: centavos a pesos", () => {
  const r = computeSubilafoto([{ date: D("2026-10-11"), amountCents: 150000, feeCents: 22500 }]);
  assert.deepEqual(r.get("2026-10"), { grossArs: 1500, processorFeeArs: 0, payoutToThirdPartiesArs: 0, netArs: 225, operationsCount: 1 });
});

test("FOTOFFICE: sólo cuenta la comisión que entró (MP, retenida o saldada), no la adeudada", () => {
  const r = computeFotoffice({
    collected: [
      { date: D("2026-09-02"), gross: 16000, fee: 800 },
      { date: D("2026-09-20"), gross: 16000, fee: 1500 },
    ],
    settledManually: [{ date: D("2026-09-25"), amount: 400 }],
  });
  assert.deepEqual(r.get("2026-9"), { grossArs: 32000, processorFeeArs: 0, payoutToThirdPartiesArs: 0, netArs: 2700, operationsCount: 3 });
});

test("FotoRank: comisión de DNX menos la comisión estimada de Mercado Pago sobre todo lo cobrado", () => {
  const r = computeFotorank([{ date: D("2026-10-01"), priceCents: 1000000, feeBps: 1500 }]);
  const mp = Math.round(10000 * FOTORANK_MP_FEE_ESTIMATE * 100) / 100;
  assert.deepEqual(r.get("2026-10"), {
    grossArs: 10000,
    processorFeeArs: mp,
    payoutToThirdPartiesArs: 10000 - 1500,
    netArs: Math.round((1500 - mp) * 100) / 100,
    operationsCount: 1,
  });
});
