import { describe, expect, it } from "vitest";
import { sanitizeError } from "./log";

describe("sanitizeError", () => {
  it("conserva el mensaje para poder diagnosticar", () => {
    expect(sanitizeError(new Error("invalid_grant"))).toContain("invalid_grant");
  });

  /** Sin esto, un token del proveedor terminaría en los logs de Vercel. */
  it.each([
    ["access token", "falló con APP_USR-1234567890abcdef-hola"],
    ["token de prueba", "falló con TEST-9876543210fedcba-chau"],
    ["refresh token", "falló con TG-abcdef1234567890-x"],
    ["cadena larga", "code=" + "a".repeat(60)],
  ])("enmascara un %s", (_label, mensaje) => {
    const out = sanitizeError(new Error(mensaje));
    expect(out).toContain("***");
    expect(out).not.toMatch(/[A-Za-z0-9_-]{40,}/);
  });

  it("recorta mensajes enormes", () => {
    expect(sanitizeError(new Error("x".repeat(5000))).length).toBeLessThanOrEqual(400);
  });

  it("tolera algo que no es un Error", () => {
    expect(sanitizeError(null)).toBe("desconocido");
    expect(sanitizeError("texto suelto")).toBe("texto suelto");
  });
});
