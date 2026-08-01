import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isClickatonCardBrickCheckoutEnabled,
  resolveClickatonMercadoPagoPublicKey,
} from "./card-brick-enabled";

describe("isClickatonCardBrickCheckoutEnabled", () => {
  it("requires orders_test provider + both flags", () => {
    assert.equal(
      isClickatonCardBrickCheckoutEnabled({
        CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_orders_test",
        DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED: "true",
        DNX_MP_ORDERS_1N_STAGING_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      isClickatonCardBrickCheckoutEnabled({
        CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_test",
        DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED: "true",
        DNX_MP_ORDERS_1N_STAGING_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      isClickatonCardBrickCheckoutEnabled({
        CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_orders_test",
        DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED: "false",
        DNX_MP_ORDERS_1N_STAGING_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv),
      false,
    );
  });
});

describe("resolveClickatonMercadoPagoPublicKey", () => {
  it("prefers NEXT_PUBLIC then TEST public key", () => {
    assert.equal(
      resolveClickatonMercadoPagoPublicKey({
        NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "TEST-pk-public",
        MERCADOPAGO_TEST_PUBLIC_KEY: "TEST-pk-server",
      } as unknown as NodeJS.ProcessEnv),
      "TEST-pk-public",
    );
    assert.equal(
      resolveClickatonMercadoPagoPublicKey({
        MERCADOPAGO_TEST_PUBLIC_KEY: "TEST-pk-server",
      } as unknown as NodeJS.ProcessEnv),
      "TEST-pk-server",
    );
    assert.equal(
      resolveClickatonMercadoPagoPublicKey({} as unknown as NodeJS.ProcessEnv),
      null,
    );
  });
});
