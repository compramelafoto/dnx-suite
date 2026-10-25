import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveHiddenSelfieRetentionDays,
  parseHiddenSelfieRetentionDays,
} from "@/lib/albums/hidden-selfie-retention";

describe("plazo de guardado de la selfie (tope 90 días)", () => {
  it("vacío o inválido → null (no se guarda)", () => {
    for (const v of [undefined, null, "", "abc", -3, "-1"]) assert.equal(parseHiddenSelfieRetentionDays(v), null);
  });
  it("valores normales se respetan", () => {
    assert.equal(parseHiddenSelfieRetentionDays("0"), 0);
    assert.equal(parseHiddenSelfieRetentionDays("30"), 30);
    assert.equal(parseHiddenSelfieRetentionDays(90), 90);
  });
  it("más de 90 queda en 90", () => {
    assert.equal(parseHiddenSelfieRetentionDays("365"), 90);
    assert.equal(parseHiddenSelfieRetentionDays(91), 90);
  });
  it("al recibir la selfie: null/0 no guarda; valores viejos > 90 se recortan", () => {
    assert.equal(effectiveHiddenSelfieRetentionDays(null), 0);
    assert.equal(effectiveHiddenSelfieRetentionDays(0), 0);
    assert.equal(effectiveHiddenSelfieRetentionDays(7), 7);
    assert.equal(effectiveHiddenSelfieRetentionDays(365), 90);
  });
});
