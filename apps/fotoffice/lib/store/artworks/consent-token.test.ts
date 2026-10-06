import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  canResendConsent,
  CONSENT_TOKEN_TTL_MS,
  hashConsentToken,
  isConsentTokenExpired,
  looksLikeConsentToken,
  newConsentToken,
} from "./consent-token";

const AHORA = new Date("2026-10-05T15:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

describe("token del permiso", () => {
  it("32 bytes en base64url; se guarda el sha256 en hex, nunca el token", () => {
    const t = newConsentToken(AHORA);
    expect(t.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(t.tokenHash).toBe(createHash("sha256").update(t.token).digest("hex"));
    expect(t.tokenHash).not.toContain(t.token);
    expect(hashConsentToken(t.token)).toBe(t.tokenHash);
  });

  it("dos tokens nunca son iguales", () => {
    expect(newConsentToken(AHORA).token).not.toBe(newConsentToken(AHORA).token);
  });

  it("vence a los 60 días", () => {
    const t = newConsentToken(AHORA);
    expect(t.tokenExpiresAt.getTime() - AHORA.getTime()).toBe(60 * DIA);
    expect(CONSENT_TOKEN_TTL_MS).toBe(60 * DIA);
    expect(isConsentTokenExpired(t.tokenExpiresAt, new Date(AHORA.getTime() + 60 * DIA - 1))).toBe(false);
    expect(isConsentTokenExpired(t.tokenExpiresAt, new Date(AHORA.getTime() + 60 * DIA))).toBe(true);
  });

  it("filtra lo que no tiene forma de token", () => {
    expect(looksLikeConsentToken(newConsentToken(AHORA).token)).toBe(true);
    expect(looksLikeConsentToken("corto")).toBe(false);
    expect(looksLikeConsentToken("a".repeat(42) + "=")).toBe(false);
    expect(looksLikeConsentToken(undefined)).toBe(false);
    expect(looksLikeConsentToken(123)).toBe(false);
  });

  it("reenviar: una vez cada 24 h; nunca enviado → se puede", () => {
    expect(canResendConsent(null, AHORA)).toBe(true);
    expect(canResendConsent(new Date(AHORA.getTime() - DIA + 1000), AHORA)).toBe(false);
    expect(canResendConsent(new Date(AHORA.getTime() - DIA), AHORA)).toBe(true);
  });
});
