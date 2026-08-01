import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRegistrationCompareAt } from "./registration-compare-at";

describe("resolveRegistrationCompareAt", () => {
  it("uses the highest phase amount as Antes when above current", () => {
    const r = resolveRegistrationCompareAt({
      currentAmount: 2_500_000,
      highestAmount: 3_500_000,
    });
    assert.equal(r.compareAt, 3_500_000);
    assert.equal(r.savings, 1_000_000);
  });

  it("does not use the mid/next phase when highest is larger", () => {
    const mid = 3_000_000;
    const highest = 3_500_000;
    const r = resolveRegistrationCompareAt({
      currentAmount: 2_500_000,
      highestAmount: highest,
    });
    assert.notEqual(r.compareAt, mid);
    assert.equal(r.compareAt, highest);
  });

  it("hides Antes when highest equals current", () => {
    const r = resolveRegistrationCompareAt({
      currentAmount: 3_500_000,
      highestAmount: 3_500_000,
    });
    assert.equal(r.compareAt, null);
    assert.equal(r.savings, null);
  });
});
