import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampPreviewScale, TEMPLATE_V2_PREVIEW_LIMITS } from "./render-limits";

describe("template-engine-renderer limits", () => {
  it("clampPreviewScale", () => {
    assert.equal(clampPreviewScale(1), 1);
    assert.equal(clampPreviewScale(0), TEMPLATE_V2_PREVIEW_LIMITS.minScale);
    assert.equal(clampPreviewScale(99), TEMPLATE_V2_PREVIEW_LIMITS.maxScale);
  });
});
