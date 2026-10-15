import assert from "node:assert/strict";
import test from "node:test";

import { readCouponAffiliate, withCouponAffiliate } from "./coupon-affiliate";

test("lee el dueño del cupón", () => {
  assert.deepEqual(
    readCouponAffiliate({ affiliate: { affiliateId: "af_1", commissionBps: 1000 } }),
    { affiliateId: "af_1", commissionBps: 1000 },
  );
});

test("metadata vacía o rota devuelve null", () => {
  const casos: unknown[] = [
    null,
    undefined,
    "texto",
    42,
    [],
    {},
    { affiliate: null },
    { affiliate: [] },
    { affiliate: "af_1" },
    { affiliate: { affiliateId: "", commissionBps: 1000 } },
    { affiliate: { affiliateId: "   ", commissionBps: 1000 } },
    { affiliate: { affiliateId: 7, commissionBps: 1000 } },
    { affiliate: { affiliateId: "af_1" } },
    { affiliate: { affiliateId: "af_1", commissionBps: "1000" } },
    { affiliate: { affiliateId: "af_1", commissionBps: 0 } },
    { affiliate: { affiliateId: "af_1", commissionBps: 10_001 } },
    { affiliate: { affiliateId: "af_1", commissionBps: 12.5 } },
  ];
  for (const metadata of casos) {
    assert.equal(readCouponAffiliate(metadata), null, JSON.stringify(metadata));
  }
});

test("escribir conserva las otras claves (por ejemplo eligibility)", () => {
  const eligibility = { kind: "PARTICIPATED_IN_EDITION", editionIds: ["ed_1"] };
  const next = withCouponAffiliate(
    { eligibility, otra: 1 },
    { affiliateId: "af_1", commissionBps: 1500 },
  );
  assert.deepEqual(next, {
    eligibility,
    otra: 1,
    affiliate: { affiliateId: "af_1", commissionBps: 1500 },
  });
  assert.deepEqual(readCouponAffiliate(next), { affiliateId: "af_1", commissionBps: 1500 });
});

test("escribir no modifica la metadata original", () => {
  const original = { eligibility: { kind: "X" } };
  withCouponAffiliate(original, { affiliateId: "af_1", commissionBps: 1000 });
  assert.deepEqual(original, { eligibility: { kind: "X" } });
});

test("null saca el dueño y deja el resto", () => {
  const next = withCouponAffiliate(
    { eligibility: { kind: "X" }, affiliate: { affiliateId: "af_1", commissionBps: 1000 } },
    null,
  );
  assert.deepEqual(next, { eligibility: { kind: "X" } });
});

test("parte de metadata vacía o inválida", () => {
  assert.deepEqual(withCouponAffiliate(null, { affiliateId: " af_1 ", commissionBps: 1 }), {
    affiliate: { affiliateId: "af_1", commissionBps: 1 },
  });
  assert.deepEqual(withCouponAffiliate([1, 2], null), {});
});

test("escribir rechaza valores inválidos", () => {
  assert.throws(() => withCouponAffiliate({}, { affiliateId: "", commissionBps: 1000 }));
  assert.throws(() => withCouponAffiliate({}, { affiliateId: "af_1", commissionBps: 0 }));
  assert.throws(() => withCouponAffiliate({}, { affiliateId: "af_1", commissionBps: 10_001 }));
});
