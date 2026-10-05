import { describe, expect, it } from "vitest";
import { pesos } from "./formato";

describe("pesos", () => {
  it("de centavos a pesos argentinos sin decimales", () => {
    expect(pesos(10_500_000)).toMatch(/105\.000/);
    expect(pesos(10_500_000)).toContain("$");
  });

  it("muestra los centavos sólo cuando hay", () => {
    expect(pesos(123_450)).toMatch(/1\.234,50/);
    expect(pesos(123_400)).toMatch(/1\.234$/);
    expect(pesos(5)).toMatch(/0,05/);
  });
});
