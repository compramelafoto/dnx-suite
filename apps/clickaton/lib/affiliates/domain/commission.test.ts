import assert from "node:assert/strict";
import test from "node:test";

import { AffiliateCommissionInputError, computeAffiliateCommission } from "./commission";

test("ejemplo del diseño: $30.000, 10% + 10%, MP 6%", () => {
  const result = computeAffiliateCommission({
    baseAmount: 3_000_000,
    commissionBps: 1000,
    mpFeeBps: 600,
    totalAmount: 2_700_000,
  });
  assert.deepEqual(result, {
    grossAmount: 300_000,
    mpFeeShareAmount: 18_000,
    netAmount: 282_000,
    ownerAmount: 2_418_000,
    splittable: true,
  });
});

test("sin comisión de MP el fotógrafo recibe el bruto entero", () => {
  const result = computeAffiliateCommission({
    baseAmount: 3_000_000,
    commissionBps: 1000,
    mpFeeBps: 0,
    totalAmount: 2_700_000,
  });
  assert.equal(result.mpFeeShareAmount, 0);
  assert.equal(result.netAmount, 300_000);
  assert.equal(result.ownerAmount, 2_400_000);
});

test("la comisión se calcula sobre el precio de lista, no sobre lo cobrado", () => {
  const conEnvio = computeAffiliateCommission({
    baseAmount: 3_000_000,
    commissionBps: 1000,
    mpFeeBps: 0,
    totalAmount: 3_500_000,
  });
  assert.equal(conEnvio.grossAmount, 300_000);
  assert.equal(conEnvio.ownerAmount, 3_200_000);
});

test("redondea al centavo", () => {
  const result = computeAffiliateCommission({
    baseAmount: 333,
    commissionBps: 1000,
    mpFeeBps: 599,
    totalAmount: 300,
  });
  assert.equal(result.grossAmount, 33);
  assert.equal(result.mpFeeShareAmount, 2);
  assert.equal(result.netAmount, 31);
  assert.equal(result.ownerAmount, 269);
});

test("un código del 100% no se puede repartir: se paga a mano", () => {
  const result = computeAffiliateCommission({
    baseAmount: 3_000_000,
    commissionBps: 1000,
    mpFeeBps: 600,
    totalAmount: 0,
  });
  assert.equal(result.netAmount, 282_000);
  assert.ok(result.ownerAmount < 0);
  assert.equal(result.splittable, false);
});

test("si al dueño no le queda nada, no hay reparto", () => {
  const result = computeAffiliateCommission({
    baseAmount: 1000,
    commissionBps: 10_000,
    mpFeeBps: 0,
    totalAmount: 1000,
  });
  assert.equal(result.ownerAmount, 0);
  assert.equal(result.splittable, false);
});

test("un neto de cero no se reparte", () => {
  const result = computeAffiliateCommission({
    baseAmount: 1,
    commissionBps: 1,
    mpFeeBps: 0,
    totalAmount: 1,
  });
  assert.equal(result.netAmount, 0);
  assert.equal(result.splittable, false);
});

test("rechaza montos negativos o no enteros", () => {
  const ok = { baseAmount: 100, commissionBps: 1000, mpFeeBps: 0, totalAmount: 100 };
  for (const bad of [
    { ...ok, baseAmount: -1 },
    { ...ok, baseAmount: 1.5 },
    { ...ok, totalAmount: -1 },
    { ...ok, totalAmount: Number.NaN },
    { ...ok, mpFeeBps: -1 },
    { ...ok, mpFeeBps: 0.5 },
  ]) {
    assert.throws(() => computeAffiliateCommission(bad), AffiliateCommissionInputError);
  }
});

test("la comisión va de 1 a 10000 bps y la de MP de 0 a 10000", () => {
  const ok = { baseAmount: 100, commissionBps: 1000, mpFeeBps: 0, totalAmount: 100 };
  assert.throws(() => computeAffiliateCommission({ ...ok, commissionBps: 0 }));
  assert.throws(() => computeAffiliateCommission({ ...ok, commissionBps: 10_001 }));
  assert.throws(() => computeAffiliateCommission({ ...ok, mpFeeBps: 10_001 }));
  assert.doesNotThrow(() => computeAffiliateCommission({ ...ok, commissionBps: 10_000 }));
  assert.doesNotThrow(() => computeAffiliateCommission({ ...ok, mpFeeBps: 10_000 }));
});
