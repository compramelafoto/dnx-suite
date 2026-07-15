import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MercadoPagoProductionWriteBlockedError,
  sanitizeProviderMessage,
} from "../../../errors/provider-errors.js";
import {
  assertSandboxToken,
  assertSandboxWriteAllowed,
  createMercadoPagoProviderConfig,
  isTestAccessToken,
  isSandboxAccessToken,
} from "../client/mercado-pago-environment.js";
import { mapMercadoPagoHttpError } from "../errors/error-mapper.js";

describe("Mercado Pago environment safety", () => {
  it("isTestAccessToken detects TEST- prefix", () => {
    assert.equal(isTestAccessToken("TEST-abc"), true);
    assert.equal(isTestAccessToken("APP_USR-abc"), false);
  });

  it("isSandboxAccessToken accepts TEST- and APP_USR-", () => {
    assert.equal(isSandboxAccessToken("TEST-abc"), true);
    assert.equal(isSandboxAccessToken("APP_USR-abc"), true);
    assert.equal(isSandboxAccessToken("OTHER"), false);
  });

  it("assertSandboxWriteAllowed blocks production", () => {
    const config = createMercadoPagoProviderConfig({
      environment: "production",
      accessToken: "APP_USR-fake",
    });
    assert.throws(() => assertSandboxWriteAllowed(config), MercadoPagoProductionWriteBlockedError);
  });

  it("assertSandboxToken allows APP_USR- in sandbox", () => {
    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: "APP_USR-fake",
    });
    assert.doesNotThrow(() => assertSandboxToken(config));
  });

  it("assertSandboxToken rejects invalid token shapes", () => {
    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: "INVALID-token",
    });
    assert.throws(() => assertSandboxToken(config), MercadoPagoProductionWriteBlockedError);
  });

  it("sanitizeProviderMessage redacts tokens", () => {
    const msg = sanitizeProviderMessage("Failed Bearer TEST-secret-token-123");
    assert.ok(!msg.includes("TEST-secret"));
    assert.ok(msg.includes("[REDACTED]"));
  });
});

describe("Mercado Pago error mapper", () => {
  it("maps CONSENT_NOT_ACTIVE to ConsentNotActiveError", () => {
    const err = mapMercadoPagoHttpError(400, { code: "CONSENT_NOT_ACTIVE" }, null);
    assert.equal(err.name, "ConsentNotActiveError");
    assert.ok(!err.message.includes("TEST-"));
  });

  it("maps OWNER_MISMATCH to RecipientNotEligibleError", () => {
    const err = mapMercadoPagoHttpError(422, { code: "OWNER_MISMATCH" }, null);
    assert.equal(err.name, "RecipientNotEligibleError");
  });

  it("maps 429 to rate limit", () => {
    const err = mapMercadoPagoHttpError(429, null, { message: "too many" });
    assert.equal(err.name, "PaymentProviderRateLimitError");
  });

  it("maps 503 to temporary", () => {
    const err = mapMercadoPagoHttpError(503, null, null);
    assert.equal(err.name, "PaymentProviderTemporaryError");
  });
});
