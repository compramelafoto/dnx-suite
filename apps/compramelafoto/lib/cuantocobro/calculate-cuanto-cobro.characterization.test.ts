/**
 * Smoke via wrapper CLF — goldens y suite completa viven en @repo/cuanto-cobro-core.
 */
import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
} from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

describe("CLF wrapper → calculateCuantoCobro", () => {
  it("caso base mantiene goldens vía reexport", () => {
    const result = calculateCuantoCobro(
      createBaseCompleteProfile(),
      createBaseCompleteQuote(),
    );
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.minimumSustainablePrice).toBe(82_491);
    expect(result.recommendedBusinessPrice).toBe(103_114);
  });
});
