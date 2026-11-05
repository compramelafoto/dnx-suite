import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCountryInput, currencyForCountry, isInternationalCountry, getCountry } from "./countries";
import { isInternationalEnabled } from "./flag";

test("normaliza variantes de texto libre", () => {
  for (const v of ["Argentina", "argentina", "ARGENTINA", " Argentina ", "AR"]) assert.equal(normalizeCountryInput(v), "AR");
  for (const v of ["México", "Mexico", "mexico", "MX"]) assert.equal(normalizeCountryInput(v), "MX");
  assert.equal(normalizeCountryInput("chile"), "CL");
  assert.equal(normalizeCountryInput("United States"), "US");
  assert.equal(normalizeCountryInput("Perú"), "PE");
  assert.equal(normalizeCountryInput("Peru"), "PE");
});
test("no adivina: vacío o desconocido da null", () => {
  for (const v of [null, undefined, "", "  ", "CABA", "Bs As", "Narnia"]) assert.equal(normalizeCountryInput(v as any), null);
});
test("moneda y carácter internacional", () => {
  assert.equal(currencyForCountry(null), "ARS");
  assert.equal(currencyForCountry("AR"), "ARS");
  assert.equal(currencyForCountry("MX"), "MXN");
  assert.equal(currencyForCountry("VE"), "USD");
  assert.equal(currencyForCountry("HN"), "USD");
  assert.equal(isInternationalCountry(null), false);
  assert.equal(isInternationalCountry("AR"), false);
  assert.equal(isInternationalCountry("CO"), true);
  assert.equal(getCountry("co")?.provider, "MERCADOPAGO_OWN");
});
test("interruptor solo con 'true'", () => {
  assert.equal(isInternationalEnabled({}), false);
  for (const v of ["TRUE", "1", "", "yes"]) assert.equal(isInternationalEnabled({ CLF_INTERNATIONAL_ENABLED: v }), false);
  assert.equal(isInternationalEnabled({ CLF_INTERNATIONAL_ENABLED: "true" }), true);
});
