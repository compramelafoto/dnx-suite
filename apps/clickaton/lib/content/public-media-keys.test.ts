import assert from "node:assert/strict";
import test from "node:test";
import { buildPartnerLogoKey } from "../admin/partners/partner-logo-storage";
import { buildBlogObjectKey } from "./blog-storage";
import { isPublicMediaKey } from "./public-media-keys";

test("el proxy público sirve las imágenes del blog", () => {
  assert.ok(isPublicMediaKey("clickaton/blog/hero/2026-08-04/abc-123.jpg"));
  assert.ok(isPublicMediaKey("clickaton/blog/media/2026-08-04/abc-123.webp"));
});

test("las claves que genera el storage del blog pasan el proxy", () => {
  for (const namespace of ["hero", "media"] as const) {
    const key = buildBlogObjectKey(namespace, "png", new Date("2026-08-04T00:00:00Z"));
    assert.ok(isPublicMediaKey(key), `debería aceptar ${key}`);
  }
});

test("el proxy sigue sirviendo los namespaces de marketing", () => {
  assert.ok(isPublicMediaKey("clickaton/editions/2026-08-04/abc-123.jpg"));
  assert.ok(isPublicMediaKey("clickaton/products/2026-08-04/abc-123.png"));
});

test("el proxy sirve los logos de sponsors subidos a R2", () => {
  assert.ok(isPublicMediaKey("clickaton/partners/logos/2026-08-25/abc-123.png"));
  const key = buildPartnerLogoKey("webp", new Date("2026-08-25T00:00:00Z"));
  assert.ok(isPublicMediaKey(key), `debería aceptar ${key}`);
});

test("el proxy no expone namespaces privados ni traversal", () => {
  const rejected = [
    "clickaton/private/2026-08-04/abc.jpg",
    "clickaton/welcome/2026-08-04/abc.jpg",
    "clickaton/profile/2026-08-04/abc.jpg",
    "clickaton/participant-cards/2026-08-04/abc.jpg",
    "clickaton/blog/2026-08-04/abc.jpg",
    "clickaton/blog/drafts/2026-08-04/abc.jpg",
    "clickaton/partners/2026-08-25/abc.png",
    "clickaton/partners/contratos/2026-08-25/abc.pdf",
    "clickaton/blog/hero/2026-08-04/../../../private/abc.jpg",
    "compramelafoto/blog/hero/2026-08-04/abc.jpg",
  ];
  for (const key of rejected) {
    assert.equal(isPublicMediaKey(key), false, `debería rechazar ${key}`);
  }
});
