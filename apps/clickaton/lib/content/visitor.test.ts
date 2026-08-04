import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICKATON_BLOG_VISITOR_COOKIE,
  CLICKATON_BLOG_VISITOR_MAX_AGE,
  isClickatonBlogArticlePath,
  resolveClickatonBlogVisitorKey,
} from "./visitor";

test("la cookie de visitante es propia de Clickatón", () => {
  assert.equal(CLICKATON_BLOG_VISITOR_COOKIE, "clickaton_blog_visitor");
  assert.notEqual(CLICKATON_BLOG_VISITOR_COOKIE, "cmlf_blog_vid");
  assert.ok(CLICKATON_BLOG_VISITOR_MAX_AGE > 0);
});

test("resolveClickatonBlogVisitorKey reutiliza una cookie válida", () => {
  const existing = "0192b1f2-1111-4a2b-8c3d-444455556666";
  const result = resolveClickatonBlogVisitorKey(existing);
  assert.equal(result.visitorKey, existing);
  assert.equal(result.isNew, false);
});

test("resolveClickatonBlogVisitorKey genera una clave nueva si falta o es corta", () => {
  for (const input of [undefined, "", "  ", "abc"]) {
    const result = resolveClickatonBlogVisitorKey(input);
    assert.equal(result.isNew, true);
    assert.ok(result.visitorKey.length >= 8);
  }
});

test("resolveClickatonBlogVisitorKey recorta claves demasiado largas", () => {
  const result = resolveClickatonBlogVisitorKey("x".repeat(200));
  assert.equal(result.visitorKey.length, 64);
  assert.equal(result.isNew, false);
});

test("isClickatonBlogArticlePath distingue notas de listados", () => {
  assert.ok(isClickatonBlogArticlePath("/blog/que-es-clickaton"));
  assert.ok(isClickatonBlogArticlePath("/blog/que-es-clickaton/"));
  assert.equal(isClickatonBlogArticlePath("/blog"), false);
  assert.equal(isClickatonBlogArticlePath("/blog/categoria"), false);
  assert.equal(isClickatonBlogArticlePath("/blog/tag"), false);
  assert.equal(isClickatonBlogArticlePath("/blog/categoria/guias"), false);
  assert.equal(isClickatonBlogArticlePath("/maratones/rosario"), false);
});
