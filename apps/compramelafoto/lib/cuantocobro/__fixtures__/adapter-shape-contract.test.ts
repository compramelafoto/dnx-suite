/**
 * Shape contract moved to @repo/cuanto-cobro-core.
 * This file keeps a CLF-path smoke through the compatibility wrapper.
 */
import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
} from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

describe("CLF adapter shape smoke", () => {
  it("wrapper produces complete", () => {
    const result = calculateCuantoCobro(
      createBaseCompleteProfile(),
      createBaseCompleteQuote(),
    );
    expect(result.status).toBe("complete");
  });
});
