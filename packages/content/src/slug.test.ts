import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeContentSlug,
  parseContentSlug,
  slugifyFromName,
  validateContentSlugFormat,
} from "./slug";

describe("content slug", () => {
  it("normalizes NFD accents, case and separators", () => {
    assert.equal(normalizeContentSlug("  Guía Fotográfica  "), "guia-fotografica");
    assert.equal(normalizeContentSlug("Hola---Mundo!!"), "hola-mundo");
    assert.equal(slugifyFromName("Clickatón 2026"), "clickaton-2026");
  });

  it("validates format", () => {
    assert.equal(validateContentSlugFormat("abc").ok, true);
    assert.equal(validateContentSlugFormat("ab").ok, false);
    assert.equal(validateContentSlugFormat("Bad Slug").ok, false);
    assert.equal(validateContentSlugFormat("-leading").ok, false);
  });

  it("honors optional reserved set", () => {
    const reserved = new Set(["admin", "blog"]);
    assert.equal(validateContentSlugFormat("admin", reserved).ok, false);
    assert.equal(validateContentSlugFormat("mi-nota", reserved).ok, true);
  });

  it("parseContentSlug returns normalized slug on success/error", () => {
    const ok = parseContentSlug("Hola Mundo");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.normalizedSlug, "hola-mundo");

    const bad = parseContentSlug("ab");
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.normalizedSlug, "ab");
      assert.ok(bad.error.length > 0);
    }
  });
});
