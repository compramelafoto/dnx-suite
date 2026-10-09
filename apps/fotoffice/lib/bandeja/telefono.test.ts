import { describe, expect, it } from "vitest";
import { mismoTelefono, ultimos10, waIdDe } from "./telefono";

describe("waIdDe", () => {
  it.each([
    ["341 341-9869", "5493413419869"],
    ["+54 9 341 3419869", "5493413419869"],
    ["0341 15 3419869", "5493413419869"],
    ["5493413419869", "5493413419869"],
    ["543413419869", "5493413419869"],
    ["+54 341 15 3419869", "5493413419869"],
    ["54 341 15 3419869", "5493413419869"],
    ["+54 9 341 3419869", "5493413419869"],
    ["341 15 3419869", "5493413419869"],
    ["https://wa.me/5493413419869?text=hola", "5493413419869"],
  ])("%s -> %s", (raw, esperado) => {
    expect(waIdDe(raw)).toBe(esperado);
  });

  it.each([["hola"], [""], [null], [undefined], ["123"], ["0000000000000000000"]])("basura %s -> null", (raw) => {
    expect(waIdDe(raw as string | null | undefined)).toBeNull();
  });
});

describe("ultimos10", () => {
  it("toma los últimos 10 dígitos, con o sin formato", () => {
    expect(ultimos10("5493413419869")).toBe("3413419869");
    expect(ultimos10("+54 9 341 3419869")).toBe("3413419869");
    expect(ultimos10("0341 15 3419869")).toBe("3413419869");
    expect(ultimos10("+54 341 15 3419869")).toBe("3413419869");
    expect(ultimos10("341 15 3419869")).toBe("3413419869");
  });
  it("con menos de 10 dígitos devuelve lo que hay", () => {
    expect(ultimos10("12345")).toBe("12345");
    expect(ultimos10("")).toBe("");
  });
});

describe("mismoTelefono", () => {
  const WA = "5493413419869";
  it.each([
    "341 341-9869", "+54 9 341 3419869", "0341 15 3419869", "341 15 3419869", "+54 341 15 3419869", "543413419869", "5493413419869",
  ])("argentino: %s es el mismo", (tel) => expect(mismoTelefono(WA, tel)).toBe(true));

  it("argentino distinto, vacío o muy corto: no", () => {
    expect(mismoTelefono(WA, "341 341-9870")).toBe(false);
    expect(mismoTelefono(WA, "")).toBe(false);
    expect(mismoTelefono(WA, null)).toBe(false);
    expect(mismoTelefono(WA, "3419869")).toBe(false);
  });
  it("de otro país: se compara completo, no por los últimos 10", () => {
    expect(mismoTelefono("5511987654321", "+55 11 98765-4321")).toBe(true);
    // Mismos últimos 10 dígitos que el waId argentino, pero es otro país: no coincide.
    expect(mismoTelefono(WA, "+1 3413419869")).toBe(false);
    expect(mismoTelefono("13413419869", "341 341 9869")).toBe(false);
  });
});
