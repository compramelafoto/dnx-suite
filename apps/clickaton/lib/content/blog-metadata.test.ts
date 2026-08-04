import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlogArticleMetadata,
  buildBlogHomeMetadata,
} from "./blog-metadata";

test("metadata del blog no duplica el sufijo de marca en title", () => {
  const home = buildBlogHomeMetadata();
  assert.equal(home.title, "Blog de Clickatón");
  assert.match(String(home.twitter?.title ?? ""), /^Blog de Clickatón — /);

  const article = buildBlogArticleMetadata({
    title: "Qué es Clickatón y cómo funciona una maratón fotográfica",
    slug: "que-es-clickaton-como-funciona-maraton-fotografica",
    excerpt: "Extracto",
    seoTitle: null,
    seoDescription: null,
    heroImageUrl: null,
    ogImageUrl: null,
    canonicalUrl: null,
    noIndex: false,
  });
  assert.equal(
    article.title,
    "Qué es Clickatón y cómo funciona una maratón fotográfica",
  );
  assert.equal(
    String(article.title).includes("— Clickatón — Clickatón"),
    false,
  );
});
