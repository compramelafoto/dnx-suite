import assert from "node:assert/strict";
import test from "node:test";

import { buildAffiliateCommissionDraft, resolveAffiliateMpFeeBps } from "./commission-draft";

const base = {
  affiliate: { affiliateId: "aff_1", commissionBps: 1000 },
  affiliateActive: true,
  promotionId: "promo_1",
  promotionCode: "FOTOANA",
  baseAmount: 3_000_000,
  totalAmount: 2_700_000,
  mpFeeBps: 600,
};

test("arma el borrador con los números del diseño", () => {
  assert.deepEqual(buildAffiliateCommissionDraft(base), {
    affiliateId: "aff_1",
    promotionId: "promo_1",
    promotionCodeSnapshot: "FOTOANA",
    commissionBps: 1000,
    baseAmount: 3_000_000,
    grossAmount: 300_000,
    mpFeeBps: 600,
    mpFeeShareAmount: 18_000,
    netAmount: 282_000,
  });
});

test("sin dueño, afiliado inactivo o sin cobro no hay comisión", () => {
  assert.equal(buildAffiliateCommissionDraft({ ...base, affiliate: null }), null);
  assert.equal(buildAffiliateCommissionDraft({ ...base, affiliateActive: false }), null);
  assert.equal(buildAffiliateCommissionDraft({ ...base, totalAmount: 0 }), null);
  assert.equal(buildAffiliateCommissionDraft({ ...base, baseAmount: 0 }), null);
});

test("si el bruto redondea a cero no se anota", () => {
  assert.equal(
    buildAffiliateCommissionDraft({ ...base, baseAmount: 1, affiliate: { affiliateId: "a", commissionBps: 1 } }),
    null,
  );
});

test("neto en cero (MP se lleva todo) igual se anota para resolverlo a mano", () => {
  const draft = buildAffiliateCommissionDraft({ ...base, mpFeeBps: 10_000 });
  assert.equal(draft?.grossAmount, 300_000);
  assert.equal(draft?.netAmount, 0);
});

test("una comisión de MP inválida se recalcula sin ella", () => {
  const draft = buildAffiliateCommissionDraft({ ...base, mpFeeBps: 20_000 });
  assert.equal(draft?.mpFeeBps, 0);
  assert.equal(draft?.netAmount, 300_000);
});

test("comisión de MP: edición, después entorno, después 0", () => {
  assert.equal(resolveAffiliateMpFeeBps(600, "400"), 600);
  assert.equal(resolveAffiliateMpFeeBps(0, "400"), 0);
  assert.equal(resolveAffiliateMpFeeBps(null, "400"), 400);
  assert.equal(resolveAffiliateMpFeeBps(undefined, " 350 "), 350);
  assert.equal(resolveAffiliateMpFeeBps(null, "abc"), 0);
  assert.equal(resolveAffiliateMpFeeBps(null, "20000"), 0);
  assert.equal(resolveAffiliateMpFeeBps(null, undefined), 0);
  assert.equal(resolveAffiliateMpFeeBps(-5, "100"), 100);
});
