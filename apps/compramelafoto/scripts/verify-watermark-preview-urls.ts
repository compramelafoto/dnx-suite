/**
 * Regresión: thumb/preview vía API (con marca); cover sin bypass a R2 en galerías.
 *
 * Uso: npx tsx scripts/verify-watermark-preview-urls.ts
 */
import assert from "node:assert/strict";
import {
  buildPhotoViewApiUrl,
  resolvePublicPhotoPreviewSrc,
} from "../lib/images/public-photo-view-url";

const photoId = 42;
const albumId = 7;
const storedPreviewUrl = "https://example.r2.dev/albums/1/preview_abc.jpg";

const thumb = resolvePublicPhotoPreviewSrc({
  photoId,
  albumId,
  storedPreviewUrl,
  mode: "thumb",
});
assert.equal(thumb, buildPhotoViewApiUrl(photoId, albumId, "thumb"));
assert.match(thumb, /mode=thumb/);
assert.doesNotMatch(thumb, /mode=preview/);

const preview = resolvePublicPhotoPreviewSrc({
  photoId,
  albumId,
  storedPreviewUrl,
  mode: "preview",
});
assert.equal(preview, buildPhotoViewApiUrl(photoId, albumId, "preview"));
assert.match(preview, /mode=preview/);
assert.doesNotMatch(preview, /r2\.dev/);

const defaultPreview = resolvePublicPhotoPreviewSrc({
  photoId,
  albumId,
  storedPreviewUrl,
});
assert.match(defaultPreview, /mode=preview/);
assert.doesNotMatch(defaultPreview, /r2\.dev/);

console.log("✅ verify-watermark-preview-urls: thumb y preview vía API; cover vía API");
