import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIntlPreferenceInput } from "./intl-preference";

test("COP: centavos guardados → monto mayor", () => {
  const p = buildIntlPreferenceInput({ id: 7, totalCents: 1150000, currency: "COP" });
  assert.equal(p.total, 11500);
  assert.equal(p.currencyId, "COP");
  assert.equal(p.marketplaceFee, undefined);
  assert.equal(p.title, "Compra de fotos - Pedido #7");
  assert.equal(p.externalReference, "7");
});
test("CLP: sin decimales", () => {
  assert.equal(buildIntlPreferenceInput({ id: 8, totalCents: 11500, currency: "CLP" }).total, 11500);
});
test("MXN con centavos", () => {
  assert.equal(buildIntlPreferenceInput({ id: 9, totalCents: 57550, currency: "MXN" }).total, 575.5);
});
