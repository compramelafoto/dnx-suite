import assert from "node:assert/strict";
import test from "node:test";

import {
  FOTORANK_MP_FEE_ESTIMATE,
  computeClf,
  computeFotoffice,
  computeFotorank,
  computeSubilafoto,
  digitalizacionWithheldArs,
  monthKeysSince,
  pendingFeeDebtByWorkspace,
} from "./compute";

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

test("FOTOFFICE: el saldo pendiente se suma por negocio, con piso 0 en cada uno", () => {
  const r = pendingFeeDebtByWorkspace([
    { workspaceId: "a", amountArs: 1000 },
    { workspaceId: "a", amountArs: -200 },
    // b quedó a favor: no tapa la deuda de a.
    { workspaceId: "b", amountArs: 300 },
    { workspaceId: "b", amountArs: -900 },
    { workspaceId: "c", amountArs: 50.5 },
  ]);
  assert.equal(r, 850.5);
  assert.equal(pendingFeeDebtByWorkspace([]), 0);
  assert.equal(pendingFeeDebtByWorkspace([{ workspaceId: "a", amountArs: -10 }]), 0);
});

const nota = (retenido: string, propio: string, deuda: string) =>
  `Comisión 5 % retenida por Mercado Pago · pedido 2026-0012 · recibo R-0003 · ${retenido} pesos (${propio} pesos de este cobro y ${deuda} pesos de deuda)`;

test("Digitalización: cuenta todo lo retenido cuando la nota cierra con el libro", () => {
  assert.equal(digitalizacionWithheldArs({ amountArs: -1500, note: nota("2.500", "1.000", "1.500") }), 2500);
  // Retenido 0 de deuda: sólo la comisión propia.
  assert.equal(digitalizacionWithheldArs({ amountArs: 0, note: nota("1.234,56", "1.234,56", "0") }), 1234.56);
  // La deuda alcanzaba menos de lo previsto: lo retenido igual entró entero.
  assert.equal(digitalizacionWithheldArs({ amountArs: -200, note: nota("1.000", "500", "200") }), 1000);
  // Sin tasa en la nota.
  const sinTasa = "Comisión retenida por Mercado Pago · pedido 7 · recibo R-1 · 1.050 pesos (1.000 pesos de este cobro y 50 pesos de deuda)";
  assert.equal(digitalizacionWithheldArs({ amountArs: -50, note: sinTasa }), 1050);
});

test("Digitalización: si la nota no se lee o no cierra, cuenta sólo la deuda cobrada", () => {
  assert.equal(digitalizacionWithheldArs({ amountArs: -1500, note: null }), 1500);
  assert.equal(digitalizacionWithheldArs({ amountArs: -1500, note: "otra cosa" }), 1500);
  // La deuda de la nota no coincide con el asiento.
  assert.equal(digitalizacionWithheldArs({ amountArs: -1400, note: nota("2.500", "1.000", "1.500") }), 1400);
  // Propio + deuda pasa lo retenido.
  assert.equal(digitalizacionWithheldArs({ amountArs: -1500, note: nota("2.000", "1.000", "1.500") }), 1500);
  // Número mal formado.
  assert.equal(digitalizacionWithheldArs({ amountArs: 0, note: nota("1,2,3", "1", "0") }), 0);
});
