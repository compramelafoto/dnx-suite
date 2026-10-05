import { describe, expect, it } from "vitest";
import { nextSaleNumber } from "./sale-number";

describe("nextSaleNumber", () => {
  it("la primera venta del workspace es la 1", () => {
    expect(nextSaleNumber(null)).toBe(1);
  });

  it("sigue a la última", () => {
    expect(nextSaleNumber(84)).toBe(85);
  });

  it("un hueco en el medio no se rellena: sigue a la mayor", () => {
    expect(nextSaleNumber(300)).toBe(301);
  });
});
