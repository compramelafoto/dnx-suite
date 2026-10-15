import { describe, expect, it } from "vitest";
import { PROVINCES, isProvinceCode } from "./provinces";

describe("provincias", () => {
  it("tiene las 24 jurisdicciones con códigos únicos", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(24);
  });
  it("reconoce códigos válidos y rechaza el resto", () => {
    expect(isProvinceCode("S")).toBe(true);
    expect(isProvinceCode("C")).toBe(true);
    expect(isProvinceCode("I")).toBe(false);
    expect(isProvinceCode("s")).toBe(false);
    expect(isProvinceCode("")).toBe(false);
  });
});
