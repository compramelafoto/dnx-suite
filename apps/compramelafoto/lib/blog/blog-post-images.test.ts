import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getBlogPostOgImageProxyUrl,
  resolveBlogPostShareImageUrl,
  resolveBlogPostThumbnailUrl,
} from "./blog-post-images";

describe("resolveBlogPostThumbnailUrl", () => {
  it("usa heroImageUrl del artículo", () => {
    const hero = "https://cdn.example.com/blog/hero/abc.jpg";
    assert.equal(resolveBlogPostThumbnailUrl({ heroImageUrl: hero }), hero);
  });

  it("usa portada por defecto si no hay hero ni og", () => {
    assert.equal(resolveBlogPostThumbnailUrl({}), "/images/blog/blog-og-cover.jpg");
  });
});

describe("resolveBlogPostShareImageUrl", () => {
  it("usa el proxy del sitio para servir la misma imagen que el artículo", () => {
    const updatedAt = "2026-06-01T12:00:00.000Z";
    const url = resolveBlogPostShareImageUrl(
      {
        slug: "mi-articulo",
        heroImageUrl: "https://cdn.example.com/blog/hero/abc.jpg",
        updatedAt,
      },
      { siteUrl: "https://compramelafoto.com" }
    );
    const v = String(new Date(updatedAt).getTime());
    assert.equal(url, `https://compramelafoto.com/api/blog/og-image/mi-articulo?v=${v}`);
  });

  it("usa proxy con slug cuando no hay portada propia", () => {
    const url = resolveBlogPostShareImageUrl({ slug: "sin-foto" });
    assert.match(url, /\/api\/blog\/og-image\/sin-foto$/);
  });
});

describe("getBlogPostOgImageProxyUrl", () => {
  it("agrega cache key opcional", () => {
    const url = getBlogPostOgImageProxyUrl("test-slug", 12345);
    assert.match(url, /\/api\/blog\/og-image\/test-slug\?v=12345$/);
  });
});
