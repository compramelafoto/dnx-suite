import { describe, expect, it } from "vitest";
import { applySurcharge } from "./surcharge";

describe("applySurcharge", () => {
  it("NONE devuelve la base", () => expect(applySurcharge(1000, { kind: "NONE", value: 500 })).toBe(1000));
  it("PERCENT en bps: 10% de 1000", () => expect(applySurcharge(1000, { kind: "PERCENT", value: 1000 })).toBe(1100));
  it("PERCENT 0 deja la base", () => expect(applySurcharge(1000, { kind: "PERCENT", value: 0 })).toBe(1000));
  it("PERCENT redondea al centavo", () => {
    expect(applySurcharge(1001, { kind: "PERCENT", value: 1000 })).toBe(1101); // 100,1 -> 100
    expect(applySurcharge(1005, { kind: "PERCENT", value: 1000 })).toBe(1106); // 100,5 -> 101
  });
  it("FIXED suma centavos", () => expect(applySurcharge(1000, { kind: "FIXED", value: 250 })).toBe(1250));
  it("FIXED 0 deja la base", () => expect(applySurcharge(1000, { kind: "FIXED", value: 0 })).toBe(1000));
  it("nunca devuelve negativo", () => {
    expect(applySurcharge(100, { kind: "FIXED", value: -500 })).toBe(0);
    expect(applySurcharge(-50, { kind: "NONE", value: 0 })).toBe(0);
  });
});
