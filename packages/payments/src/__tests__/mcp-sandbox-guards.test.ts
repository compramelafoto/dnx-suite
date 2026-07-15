import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MercadoPagoProductionWriteBlockedError } from "../errors/provider-errors.js";
import {
  createMercadoPagoProviderConfig,
  assertSandboxWriteAllowed,
  assertSandboxToken,
  isTestAccessToken,
  isSandboxAccessToken,
} from "../providers/mercado-pago/client/mercado-pago-environment.js";

describe("MCP Mercado Pago sandbox guards", () => {
  it("denies production writes", () => {
    const config = createMercadoPagoProviderConfig({
      environment: "production",
      accessToken: "APP_USR-fake",
    });
    assert.throws(() => assertSandboxWriteAllowed(config), MercadoPagoProductionWriteBlockedError);
  });

  it("detects legacy TEST- prefix separately from sandbox eligibility", () => {
    assert.equal(isTestAccessToken("TEST-abc"), true);
    assert.equal(isTestAccessToken("APP_USR-abc"), false);
    assert.equal(isSandboxAccessToken("TEST-abc"), true);
    assert.equal(isSandboxAccessToken("APP_USR-abc"), true);
  });

  it("allows APP_USR- tokens in sandbox (MLA Credenciales de prueba)", () => {
    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: "APP_USR-fake-test-panel",
    });
    assert.doesNotThrow(() => assertSandboxToken(config));
  });
});
