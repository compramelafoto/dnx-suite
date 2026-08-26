import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICKATON_BLOG_BASE_PATH,
  blogCategoryPath,
  blogHomePath,
  blogPostPath,
  blogTagPath,
  clickatonContentSite,
} from "./content-site-config";

test("el blog vive bajo /blog", () => {
  assert.equal(CLICKATON_BLOG_BASE_PATH, "/blog");
  assert.equal(blogHomePath(), "/blog");
});

test("las rutas del blog se construyen desde el slug", () => {
  assert.equal(blogPostPath("que-es-clickaton"), "/blog/que-es-clickaton");
  assert.equal(blogCategoryPath("guias"), "/blog/categoria/guias");
  assert.equal(blogTagPath("rosario"), "/blog/tag/rosario");
});

test("las rutas escapan slugs con caracteres inseguros", () => {
  assert.equal(blogPostPath("a b"), "/blog/a%20b");
  assert.equal(blogPostPath("a/b"), "/blog/a%2Fb");
});

test("la marca del blog es Clickatón, no ComprameLaFoto", () => {
  assert.equal(clickatonContentSite.siteName, "Clickatón");
  assert.equal(clickatonContentSite.publisherName, "Clickatón");
  assert.equal(clickatonContentSite.locale, "es_AR");
});
