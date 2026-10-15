import assert from "node:assert/strict";
import test from "node:test";

import {
  affiliateNeedsMpAction,
  commissionBadgeVariant,
  consentBadgeVariant,
  formatArsMinor,
  parseCouponAffiliateForm,
  parsePercentToBps,
  safeInviteUrl,
  summarizeCommissions,
  summarizeOwedByAffiliate,
} from "./presentation";

test("porcentaje a puntos básicos", () => {
  assert.equal(parsePercentToBps("10"), 1000);
  assert.equal(parsePercentToBps("12,5"), 1250);
  assert.equal(parsePercentToBps("0.25"), 25);
  assert.equal(parsePercentToBps(" 7,75 % "), 775);
  assert.equal(parsePercentToBps("100"), 10_000);
  assert.equal(parsePercentToBps("0,01"), 1);
});

test("porcentajes inválidos", () => {
  assert.equal(parsePercentToBps(""), null);
  assert.equal(parsePercentToBps(null), null);
  assert.equal(parsePercentToBps("0"), null);
  assert.equal(parsePercentToBps("0,001"), null);
  assert.equal(parsePercentToBps("100,01"), null);
  assert.equal(parsePercentToBps("-5"), null);
  assert.equal(parsePercentToBps("diez"), null);
  assert.equal(parsePercentToBps("1.000"), null);
});

test("totales por estado", () => {
  const totals = summarizeCommissions([
    { status: "OWED", netAmount: 282_000 },
    { status: "OWED", netAmount: 100_000 },
    { status: "PAID_BY_SPLIT", netAmount: 50_000 },
    { status: "RARO", netAmount: 999 },
  ]);
  assert.deepEqual(totals.OWED, { count: 2, netAmount: 382_000 });
  assert.deepEqual(totals.PAID_BY_SPLIT, { count: 1, netAmount: 50_000 });
  assert.deepEqual(totals.PENDING, { count: 0, netAmount: 0 });
  assert.deepEqual(totals.PAID_OUT, { count: 0, netAmount: 0 });
  assert.deepEqual(totals.REVERSED, { count: 0, netAmount: 0 });
});

test("deuda por fotógrafo: sólo lo que está a transferir, de mayor a menor", () => {
  const owed = summarizeOwedByAffiliate([
    { status: "OWED", netAmount: 1000, affiliateId: "a", affiliateName: "Ana" },
    { status: "OWED", netAmount: 5000, affiliateId: "b", affiliateName: "Beto" },
    { status: "OWED", netAmount: 2000, affiliateId: "a", affiliateName: "Ana" },
    { status: "PAID_OUT", netAmount: 9000, affiliateId: "c", affiliateName: "Caro" },
  ]);
  assert.deepEqual(owed, [
    { affiliateId: "b", displayName: "Beto", owedAmount: 5000, owedCount: 1 },
    { affiliateId: "a", displayName: "Ana", owedAmount: 3000, owedCount: 2 },
  ]);
});

test("pesos desde centavos", () => {
  assert.equal(formatArsMinor(282_000), `$${(2820).toLocaleString("es-AR")}`);
  assert.equal(formatArsMinor(0), "$0");
});

test("colores de estado", () => {
  assert.equal(consentBadgeVariant("active"), "success");
  assert.equal(consentBadgeVariant(null), "neutral");
  assert.equal(commissionBadgeVariant("OWED"), "warning");
  assert.equal(commissionBadgeVariant("OTRO"), "neutral");
});

test("Mercado Pago: hace falta actuar mientras no esté vinculado", () => {
  assert.equal(affiliateNeedsMpAction("ACTIVE"), false);
  assert.equal(affiliateNeedsMpAction("PENDING"), true);
  assert.equal(affiliateNeedsMpAction(null), true);
  assert.equal(affiliateNeedsMpAction("EXPIRED"), true);
});

test("bloque de código de fotógrafo: los dos datos o ninguno", () => {
  assert.deepEqual(parseCouponAffiliateForm({ affiliateId: "", percent: " " }), {
    ok: true,
    value: null,
  });
  assert.deepEqual(parseCouponAffiliateForm({ affiliateId: "af1", percent: "10,5" }), {
    ok: true,
    value: { affiliateId: "af1", commissionBps: 1050 },
  });
  assert.equal(parseCouponAffiliateForm({ affiliateId: "af1", percent: "" }).ok, false);
  assert.equal(parseCouponAffiliateForm({ affiliateId: "", percent: "10" }).ok, false);
  assert.equal(parseCouponAffiliateForm({ affiliateId: "af1", percent: "150" }).ok, false);
});

test("link de invitación: sólo https", () => {
  assert.equal(
    safeInviteUrl("https://www.mercadopago.com.ar/split?x=1"),
    "https://www.mercadopago.com.ar/split?x=1",
  );
  assert.equal(safeInviteUrl("javascript:alert(1)"), null);
  assert.equal(safeInviteUrl("http://inseguro.com"), null);
  assert.equal(safeInviteUrl("no es url"), null);
  assert.equal(safeInviteUrl(null), null);
});
