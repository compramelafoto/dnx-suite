import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MERCADOPAGO_ORDERS_CAPABILITIES } from "../providers/mercado-pago/capabilities.js";

describe("MERCADOPAGO_ORDERS_CAPABILITIES", () => {
  it("declares split 1:N support", () => {
    assert.equal(MERCADOPAGO_ORDERS_CAPABILITIES.supportsSplit1N, true);
    assert.equal(MERCADOPAGO_ORDERS_CAPABILITIES.supportsSplitConsent, true);
    assert.ok(MERCADOPAGO_ORDERS_CAPABILITIES.supportedCurrencies.includes("ARS"));
  });
});
