import { describe, expect, it } from "vitest";
import { ultimos10, waIdDe } from "./telefono";

describe("waIdDe", () => {
  it.each([
    ["341 341-9869", "5493413419869"],
    ["+54 9 341 3419869", "5493413419869"],
    ["0341 15 3419869", "5493413419869"],
    ["5493413419869", "5493413419869"],
    ["543413419869", "5493413419869"],
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
  });
  it("con menos de 10 dígitos devuelve lo que hay", () => {
    expect(ultimos10("12345")).toBe("12345");
    expect(ultimos10("")).toBe("");
  });
});
