import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOG_IMAGE_MAX_BYTES,
  CLICKATON_BLOG_KEY_ROOT,
  blogKeyPrefix,
  buildBlogObjectKey,
  extensionForMimeType,
  hasR2BlogStorage,
  isClickatonBlogKey,
  resolveClickatonBlogStorage,
  validateBlogImageFile,
} from "./blog-storage";

test("los prefijos viven bajo clickaton/blog", () => {
  assert.equal(CLICKATON_BLOG_KEY_ROOT, "clickaton/blog");
  assert.equal(blogKeyPrefix("hero"), "clickaton/blog/hero");
  assert.equal(blogKeyPrefix("media"), "clickaton/blog/media");
});

test("buildBlogObjectKey genera claves con fecha y extensión saneada", () => {
  const key = buildBlogObjectKey("hero", "JPG", new Date("2026-08-04T10:00:00Z"));
  assert.match(key, /^clickaton\/blog\/hero\/2026-08-04\/[0-9a-f-]{36}\.jpg$/);
  assert.ok(isClickatonBlogKey(key));
});

test("buildBlogObjectKey no permite escapar del prefijo vía extensión", () => {
  const key = buildBlogObjectKey("media", "../../etc/passwd", new Date("2026-08-04T00:00:00Z"));
  assert.ok(key.startsWith("clickaton/blog/media/"));
  assert.equal(key.includes(".."), false);
  assert.ok(isClickatonBlogKey(key));
});

test("isClickatonBlogKey rechaza claves fuera del namespace del blog", () => {
  const rejected = [
    "clickaton/welcome/2026-08-04/aaa.jpg",
    "clickaton/private/2026-08-04/aaa.jpg",
    "clickaton/blog/private/2026-08-04/aaa.jpg",
    "clickaton/blog/hero/../../secret.jpg",
    "compramelafoto/blog/hero/2026-08-04/aaa.jpg",
    "clickaton/blog/hero/aaa.jpg",
    "",
  ];
  for (const key of rejected) {
    assert.equal(isClickatonBlogKey(key), false, `debería rechazar ${key}`);
  }
});

test("isClickatonBlogKey acepta hero y media", () => {
  assert.ok(isClickatonBlogKey("clickaton/blog/hero/2026-08-04/abc-123.webp"));
  assert.ok(isClickatonBlogKey("clickaton/blog/media/2026-01-31/abc-123.png"));
});

test("validateBlogImageFile limita mime y tamaño", () => {
  assert.deepEqual(validateBlogImageFile({ type: "image/jpeg", size: 1024 }), { ok: true });
  assert.deepEqual(validateBlogImageFile({ type: "image/webp", size: 1024 }), { ok: true });

  const badType = validateBlogImageFile({ type: "image/gif", size: 1024 });
  assert.equal(badType.ok, false);

  const tooBig = validateBlogImageFile({
    type: "image/png",
    size: BLOG_IMAGE_MAX_BYTES + 1,
  });
  assert.equal(tooBig.ok, false);

  const empty = validateBlogImageFile({ type: "image/png", size: 0 });
  assert.equal(empty.ok, false);
});

test("extensionForMimeType prioriza el mime sobre el nombre", () => {
  assert.equal(extensionForMimeType("image/webp", "foto.jpg"), "webp");
  assert.equal(extensionForMimeType("image/png", "foto.jpg"), "png");
  assert.equal(extensionForMimeType("application/octet-stream", "foto.jpeg"), "jpeg");
  assert.equal(extensionForMimeType("application/octet-stream"), "jpg");
});

test("hasR2BlogStorage requiere las cuatro variables de R2", () => {
  assert.equal(hasR2BlogStorage({}), false);
  assert.equal(
    hasR2BlogStorage({
      R2_BUCKET_NAME: "b",
      R2_ENDPOINT: "https://r2.example",
      R2_ACCESS_KEY_ID: "k",
    }),
    false,
  );
  assert.equal(
    hasR2BlogStorage({
      R2_BUCKET: "b",
      R2_ENDPOINT: "https://r2.example",
      R2_ACCESS_KEY_ID: "k",
      R2_SECRET_ACCESS_KEY: "s",
    }),
    true,
  );
});

const completeR2 = {
  R2_BUCKET: "clickaton-media-staging",
  R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "k",
  R2_SECRET_ACCESS_KEY: "s",
};

test("resolveClickatonBlogStorage usa R2 cuando está completo", () => {
  const resolved = resolveClickatonBlogStorage(completeR2);
  assert.equal(resolved.kind, "r2");
});

test("resolveClickatonBlogStorage permite fallback local solo en development", () => {
  const local = resolveClickatonBlogStorage({ NODE_ENV: "development" });
  assert.equal(local.kind, "local");

  const vercelPreview = resolveClickatonBlogStorage({
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    VERCEL: "1",
  });
  assert.equal(vercelPreview.kind, "unavailable");
  if (vercelPreview.kind === "unavailable") {
    assert.equal(vercelPreview.code, "CONTENT_STORAGE_NOT_CONFIGURED");
  }

  const vercelProd = resolveClickatonBlogStorage({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    VERCEL: "1",
  });
  assert.equal(vercelProd.kind, "unavailable");
});

test("validateBlogImageFile rechaza SVG", () => {
  const svg = validateBlogImageFile({ type: "image/svg+xml", size: 1024 });
  assert.equal(svg.ok, false);
});
