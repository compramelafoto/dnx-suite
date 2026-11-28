import { describe, expect, it } from "vitest";
import { normalizarTelefono } from "./telefono";

describe("normalizarTelefono", () => {
  it("todas las formas de un celular de Rosario dan lo mismo que WhatsApp", () => {
    const esperado = "543415551234";
    for (const f of [
      "341 555-1234",
      "+54 9 341 5551234",
      "03415551234",
      "0341 15 555-1234",
      "341 15 555-1234",
      "5493415551234",
      "543415551234",
    ]) {
      expect(normalizarTelefono(f), f).toBe(esperado);
    }
  });

  it("Buenos Aires: 011 15 1234-5678 y 11 1234-5678", () => {
    expect(normalizarTelefono("011 15 1234-5678")).toBe("541112345678");
    expect(normalizarTelefono("11 1234-5678")).toBe("541112345678");
    expect(normalizarTelefono("5491112345678")).toBe("541112345678");
  });

  it("no normalizables -> vacío", () => {
    for (const f of ["", "12", "abc", "123456789", "0341555", "5493415551234999"]) {
      expect(normalizarTelefono(f), f).toBe("");
    }
  });
});
