import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MercadoPagoProductionWriteBlockedError } from "../errors/provider-errors.js";
import {
  createMercadoPagoProviderConfig,
  assertSandboxWriteAllowed,
  isTestAccessToken,
} from "../providers/mercado-pago/client/mercado-pago-environment.js";

describe("MCP Mercado Pago sandbox guards", () => {
  it("denies production writes", () => {
    const config = createMercadoPagoProviderConfig({
      environment: "production",
      accessToken: "APP_USR-fake",
    });
    assert.throws(() => assertSandboxWriteAllowed(config), MercadoPagoProductionWriteBlockedError);
  });

  it("requires TEST- token shape for sandbox writes", () => {
    assert.equal(isTestAccessToken("TEST-abc"), true);
    assert.equal(isTestAccessToken("APP_USR-abc"), false);
  });
});
