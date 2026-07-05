import { describe, expect, it } from "vitest";
import { parseFrozenCalculation } from "./quote-frozen";

describe("parseFrozenCalculation", () => {
  it("devuelve cálculo completo cuando el snapshot es válido", () => {
    const snapshot = {
      status: "complete",
      currency: "ARS",
      recommendedBusinessPrice: 100,
      minimumSustainablePrice: 80,
    };

    expect(parseFrozenCalculation(snapshot)?.recommendedBusinessPrice).toBe(100);
  });

  it("rechaza snapshots incompletos o migrados sin campos clave", () => {
    expect(parseFrozenCalculation({ status: "incomplete" })).toBeNull();
    expect(parseFrozenCalculation(null)).toBeNull();
    expect(parseFrozenCalculation({ status: "complete", migrated: true })).toBeNull();
  });
});
