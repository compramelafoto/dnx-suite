import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTENT_ERROR_CODES, ContentError, isContentError } from "./errors";

describe("ContentError", () => {
  it("exposes all domain codes", () => {
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_PLATFORM_REQUIRED"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_NOT_FOUND"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_SLUG_CONFLICT"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_CATEGORY_NOT_FOUND"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_TAG_NOT_FOUND"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_AUTHOR_NOT_FOUND"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_MEDIA_NOT_FOUND"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_RELATION_PLATFORM_MISMATCH"));
    assert.ok(CONTENT_ERROR_CODES.includes("CONTENT_INVALID_STATUS"));
  });

  it("is identifiable via isContentError", () => {
    const err = new ContentError("CONTENT_NOT_FOUND", "missing");
    assert.equal(err.code, "CONTENT_NOT_FOUND");
    assert.equal(err.message, "missing");
    assert.equal(isContentError(err), true);
    assert.equal(isContentError(new Error("nope")), false);
  });
});
