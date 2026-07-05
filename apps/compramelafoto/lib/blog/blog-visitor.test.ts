import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBlogArticlePath, resolveBlogVisitorKey } from "./blog-visitor";

describe("isBlogArticlePath", () => {
  it("acepta artículos por slug", () => {
    assert.equal(isBlogArticlePath("/blog/como-vender-fotos"), true);
  });

  it("rechaza listado, categorías y tags", () => {
    assert.equal(isBlogArticlePath("/blog"), false);
    assert.equal(isBlogArticlePath("/blog/categoria/tutoriales"), false);
    assert.equal(isBlogArticlePath("/blog/tag/fotografia"), false);
  });
});

describe("resolveBlogVisitorKey", () => {
  it("reutiliza cookie existente", () => {
    const result = resolveBlogVisitorKey("abc12345");
    assert.equal(result.isNew, false);
    assert.equal(result.visitorKey, "abc12345");
  });

  it("genera clave nueva si no hay cookie", () => {
    const result = resolveBlogVisitorKey(undefined);
    assert.equal(result.isNew, true);
    assert.ok(result.visitorKey.length >= 8);
  });
});
