import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CONTENT_TYPE_LABELS,
  DEFAULT_CONTENT_UI_LABELS,
  mergeContentUiLabels,
} from "./labels";

describe("content-ui labels", () => {
  it("default labels cover key surfaces", () => {
    assert.ok(DEFAULT_CONTENT_UI_LABELS.fallbackShareNote.includes("logo del sitio"));
    assert.ok(!DEFAULT_CONTENT_UI_LABELS.fallbackShareNote.toLowerCase().includes("comprame"));
    assert.equal(DEFAULT_CONTENT_UI_LABELS.saveDraft.length > 0, true);
    assert.equal(DEFAULT_CONTENT_TYPE_LABELS.BLOG, "Artículo");
  });

  it("mergeContentUiLabels overlays partials", () => {
    const merged = mergeContentUiLabels({ publish: "Publicar ahora" });
    assert.equal(merged.publish, "Publicar ahora");
    assert.equal(merged.saveDraft, DEFAULT_CONTENT_UI_LABELS.saveDraft);
  });
});
