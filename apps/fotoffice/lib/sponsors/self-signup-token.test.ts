import { describe, expect, it } from "vitest";
import {
  generateSelfSignupToken,
  hashSelfSignupToken,
  isSelfSignupUsable,
  looksLikeSelfSignupToken,
  selfSignupExpiry,
  selfSignupUrl,
} from "./self-signup-token";

const AHORA = new Date("2026-10-06T15:00:00Z");

describe("token de autoalta de sponsors", () => {
  it("genera tokens distintos que pasan el filtro de forma", () => {
    const a = generateSelfSignupToken();
    const b = generateSelfSignupToken();
    expect(a).not.toBe(b);
    expect(looksLikeSelfSignupToken(a)).toBe(true);
  });

  it("rechaza de entrada lo que no tiene forma de token", () => {
    expect(looksLikeSelfSignupToken("")).toBe(false);
    expect(looksLikeSelfSignupToken("abc")).toBe(false);
    expect(looksLikeSelfSignupToken("a".repeat(43) + "/")).toBe(false);
  });

  it("guarda un hash estable y distinto del token", () => {
    const t = generateSelfSignupToken();
    expect(hashSelfSignupToken(t)).toBe(hashSelfSignupToken(t));
    expect(hashSelfSignupToken(t)).not.toContain(t);
    expect(hashSelfSignupToken(t)).toHaveLength(64);
  });

  it("vence a los 30 días", () => {
    expect(selfSignupExpiry(AHORA).toISOString()).toBe("2026-11-05T15:00:00.000Z");
  });

  it("sirve sólo pendiente o abierto, sin vencer y sin revocar", () => {
    const base = { status: "PENDING" as const, expiresAt: selfSignupExpiry(AHORA), revokedAt: null };
    expect(isSelfSignupUsable(base, AHORA)).toBe(true);
    expect(isSelfSignupUsable({ ...base, status: "OPENED" }, AHORA)).toBe(true);
    expect(isSelfSignupUsable({ ...base, status: "SUBMITTED" }, AHORA)).toBe(false);
    expect(isSelfSignupUsable({ ...base, revokedAt: AHORA }, AHORA)).toBe(false);
    expect(isSelfSignupUsable({ ...base, expiresAt: AHORA }, AHORA)).toBe(false);
  });

  it("arma el enlace sólo si conoce la dirección de la aplicación", () => {
    expect(selfSignupUrl("https://fotoffice.com", "xyz")).toBe("https://fotoffice.com/sponsor/xyz");
    expect(selfSignupUrl("", "xyz")).toBe("");
  });
});
