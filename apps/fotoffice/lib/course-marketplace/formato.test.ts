import { describe, expect, it } from "vitest";
import { pesos } from "./formato";

describe("pesos", () => {
  it("de centavos a pesos argentinos sin decimales", () => {
    expect(pesos(10_500_000)).toMatch(/105\.000/);
    expect(pesos(10_500_000)).toContain("$");
  });
});
