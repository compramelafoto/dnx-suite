import { describe, expect, it } from "vitest";
import { esTokenConForma, hashDeToken, nuevoTokenDeInvitacion } from "./token";

describe("token de invitación", () => {
  it("guarda el hash, no el token", () => {
    const { token, hash } = nuevoTokenDeInvitacion();
    expect(esTokenConForma(token)).toBe(true);
    expect(hash).toBe(hashDeToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
  it("cada invitación es distinta", () => {
    expect(nuevoTokenDeInvitacion().token).not.toBe(nuevoTokenDeInvitacion().token);
  });
  it("rechaza lo que no tiene forma de token", () => {
    expect(esTokenConForma("corto")).toBe(false);
    expect(esTokenConForma(`${"a".repeat(42)}/`)).toBe(false);
    expect(esTokenConForma(null)).toBe(false);
  });
});
