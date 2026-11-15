import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeWallet,
  validateTopUp,
  topUpCharge,
  suggestTopUp,
  crossedLowBalance,
  splitTopUpPayment,
} from "./wallet";

const at = new Date("2026-11-14T12:00:00Z");

test("saldo y deuda con adelanto y una venta", () => {
  assert.deepEqual(
    computeWallet([
      { type: "ADVANCE", amountUsdCents: 2500, createdAt: at, note: null },
      { type: "COMMISSION", amountUsdCents: -38, createdAt: at, note: null },
    ]),
    { balanceUsdCents: 2462, advanceDebtUsdCents: 2500 },
  );
});
test("devolver el adelanto no cambia el saldo y deja la deuda en cero", () => {
  assert.deepEqual(
    computeWallet([
      { type: "ADVANCE", amountUsdCents: 2500, createdAt: at, note: null },
      { type: "COMMISSION", amountUsdCents: -2600, createdAt: at, note: null },
      { type: "ADVANCE_REPAID", amountUsdCents: 0, createdAt: at, note: '{"repaidUsdCents":2500}' },
      { type: "TOPUP", amountUsdCents: 1000, createdAt: at, note: null },
    ]),
    { balanceUsdCents: 900, advanceDebtUsdCents: 0 },
  );
});
test("recarga mínima de 10 USD y montos enteros", () => {
  assert.deepEqual(validateTopUp(999), { ok: false, message: "La recarga mínima es de 10 USD." });
  assert.deepEqual(validateTopUp(1000), { ok: true });
  assert.equal(validateTopUp(1000.5).ok, false);
  assert.equal(validateTopUp(100001).ok, false);
});
test("lo que se cobra incluye el adelanto adeudado", () => {
  assert.equal(topUpCharge(1000, 2500), 3500);
  assert.equal(topUpCharge(5000, 0), 5000);
});
test("sugerencia según lo consumido en 30 días", () => {
  assert.deepEqual(suggestTopUp(0), { options: [2500, 5000, 10000], recommended: 2500 });
  assert.equal(suggestTopUp(2500).recommended, 2500);
  assert.equal(suggestTopUp(3000).recommended, 5000);
  assert.equal(suggestTopUp(20000).recommended, 10000);
});
test("cruce del umbral de saldo bajo (5 USD)", () => {
  assert.equal(crossedLowBalance(600, 450), true);
  assert.equal(crossedLowBalance(500, 499), true);
  assert.equal(crossedLowBalance(450, 300), false);
  assert.equal(crossedLowBalance(900, 600), false);
});

test("reparto de lo pagado: primero el adelanto adeudado, el resto al saldo", () => {
  assert.deepEqual(splitTopUpPayment(3500, 2500), { creditUsdCents: 1000, advanceRepaidUsdCents: 2500 });
  assert.deepEqual(splitTopUpPayment(3500, 0), { creditUsdCents: 3500, advanceRepaidUsdCents: 0 });
  assert.deepEqual(splitTopUpPayment(1000, 2500), { creditUsdCents: 0, advanceRepaidUsdCents: 1000 });
});
