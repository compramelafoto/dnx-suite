import { describe, expect, it } from "vitest";
import { hashDni, normalizeDni } from "./dni";

describe("normalizeDni", () => {
  it("saca los puntos", () => {
    expect(normalizeDni("30.123.456")).toBe("30123456");
  });
  it("acepta 7 dígitos", () => {
    expect(normalizeDni("1234567")).toBe("1234567");
  });
  it("rechaza muy corto o muy largo", () => {
    expect(normalizeDni("12")).toBeNull();
    expect(normalizeDni("123456789")).toBeNull();
  });
  it("rechaza letras", () => {
    expect(normalizeDni("30a23456")).toBeNull();
  });
});

describe("hashDni", () => {
  it("es estable y hexadecimal de 64 caracteres", () => {
    const h = hashDni("30123456", "pimienta");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDni("30123456", "pimienta")).toBe(h);
  });
  it("cambia con otra pimienta o con otro DNI", () => {
    const h = hashDni("30123456", "pimienta");
    expect(hashDni("30123456", "otra")).not.toBe(h);
    expect(hashDni("30123457", "pimienta")).not.toBe(h);
  });
});
