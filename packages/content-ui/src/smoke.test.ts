import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CONTENT_UI_LABELS,
  buildContentPostSubmitPayload,
  mergeContentUiLabels,
  syncContentPostImageFields,
  toContentFormError,
} from "./index";

describe("content-ui smoke imports", () => {
  it("exports pure helpers from package entry", () => {
    assert.equal(typeof buildContentPostSubmitPayload, "function");
    assert.equal(typeof syncContentPostImageFields, "function");
    assert.equal(typeof mergeContentUiLabels, "function");
    assert.equal(typeof toContentFormError, "function");
    assert.ok(DEFAULT_CONTENT_UI_LABELS.mediaLibraryTitle);
  });
});
