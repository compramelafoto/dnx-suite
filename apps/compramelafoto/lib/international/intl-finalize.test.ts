import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIntlPayment, commissionForOrder, applyIntlCommission, type IntlCommissionDeps } from "./intl-finalize";

test("pago correcto en COP", () => {
  assert.deepEqual(
    checkIntlPayment({ totalCents: 1150000, currency: "COP" }, { currency_id: "COP", transaction_amount: 11500 }),
    { ok: true },
  );
  assert.deepEqual(
    checkIntlPayment({ totalCents: 1150000, currency: "COP" }, { currency_id: "COP", transaction_amount: 11500.6 }),
    { ok: true },
  );
});
test("otra moneda u otro monto: no se confirma (Review Focus 2)", () => {
  assert.deepEqual(
    checkIntlPayment({ totalCents: 1150000, currency: "COP" }, { currency_id: "ARS", transaction_amount: 11500 }),
    { ok: false, reason: "CURRENCY" },
  );
  assert.deepEqual(
    checkIntlPayment({ totalCents: 1150000, currency: "COP" }, { currency_id: "COP", transaction_amount: 11000 }),
    { ok: false, reason: "AMOUNT" },
  );
});
test("lee la comisión del snapshot", () => {
  assert.deepEqual(commissionForOrder({ intlV1: { commissionStored: 150000, currency: "COP" } }), {
    commissionStored: 150000,
    currency: "COP",
  });
  assert.equal(commissionForOrder({}), null);
  assert.equal(commissionForOrder(null), null);
});

function deps(over: Partial<IntlCommissionDeps> = {}) {
  const mails: string[] = [];
  const calls: number[] = [];
  let created = true;
  const d: IntlCommissionDeps = {
    loadOrder: async () => ({
      id: 5,
      currency: "COP",
      pricingSnapshot: { intlV1: { commissionStored: 150000, currency: "COP" } },
      ownerUserId: 1038,
      ownerEmail: "w@example.com",
    }),
    latestFxRate: async () => ({ id: "fx1", unitsPerUsdBuy: "4000", unitsPerUsdSell: "4000", fetchedAt: new Date() }),
    recordCommission: async (p) => {
      calls.push(p.amountUsdCents);
      const r = created
        ? { created: true, balanceBefore: 520, balanceAfter: 520 - p.amountUsdCents }
        : { created: false, balanceBefore: 482, balanceAfter: 482 };
      created = false;
      return r;
    },
    sendLowBalanceEmail: async (to) => {
      mails.push(to);
    },
    ...over,
  };
  return { d, mails, calls };
}

test("descuenta 38 centavos de USD por 1.500 COP y avisa una sola vez (Review Focus 1)", async () => {
  const { d, mails, calls } = deps();
  const first = await applyIntlCommission(5, d);
  const second = await applyIntlCommission(5, d);
  assert.deepEqual(first, { created: true, lowBalanceCrossed: true });
  assert.deepEqual(second, { created: false, lowBalanceCrossed: false });
  assert.deepEqual(calls, [38, 38]);
  assert.deepEqual(mails, ["w@example.com"]);
});
test("sin cotización no descuenta y lo informa", async () => {
  const { d, calls } = deps({ latestFxRate: async () => null });
  await assert.rejects(() => applyIntlCommission(5, d), /sin cotización/);
  assert.deepEqual(calls, []);
});
