/**
 * Tests de enrutado de lectura R2 Info Spot vs CLF (sin red / sin S3).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/r2-read.test.ts
 */

import assert from "node:assert/strict";
import { isInfoSpotOwnedR2Key } from "./r2-key-policy";
import {
  buildClfPublicObjectUrl,
  getClfR2BucketName,
  getClfR2PublicBaseUrl,
  isClfR2ReadConfigured,
} from "./r2-clf-config";
import { resolveClfPhotoPreviewSourceKey, resolveClfPhotoSourceKey } from "./r2-read";

const prev = {
  CLF_R2_BUCKET_NAME: process.env.CLF_R2_BUCKET_NAME,
  CLF_R2_BUCKET: process.env.CLF_R2_BUCKET,
  CLF_R2_PUBLIC_URL: process.env.CLF_R2_PUBLIC_URL,
  CLF_R2_PUBLIC_BASE_URL: process.env.CLF_R2_PUBLIC_BASE_URL,
  COMPRAMELAFOTO_R2_PUBLIC_URL: process.env.COMPRAMELAFOTO_R2_PUBLIC_URL,
};

function restoreEnv() {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

try {
  delete process.env.CLF_R2_BUCKET_NAME;
  delete process.env.CLF_R2_BUCKET;
  delete process.env.CLF_R2_PUBLIC_URL;
  delete process.env.CLF_R2_PUBLIC_BASE_URL;
  delete process.env.COMPRAMELAFOTO_R2_PUBLIC_URL;

  assert.equal(isClfR2ReadConfigured(), false);
  assert.equal(getClfR2BucketName(), null);
  assert.equal(getClfR2PublicBaseUrl(), null);

  process.env.CLF_R2_PUBLIC_URL = "https://pub-clf.example.r2.dev/";
  assert.equal(isClfR2ReadConfigured(), true);
  assert.equal(getClfR2PublicBaseUrl(), "https://pub-clf.example.r2.dev");
  assert.equal(
    buildClfPublicObjectUrl("photo-variants/1/thumb_wm_v7.jpg"),
    "https://pub-clf.example.r2.dev/photo-variants/1/thumb_wm_v7.jpg",
  );
  assert.throws(() => buildClfPublicObjectUrl("https://evil.example/a.jpg"));
  assert.throws(() => buildClfPublicObjectUrl("../x"));

  process.env.CLF_R2_BUCKET_NAME = "compramelafoto-prod";
  assert.equal(getClfR2BucketName(), "compramelafoto-prod");

  assert.equal(isInfoSpotOwnedR2Key("infospot/editorial/clf/1/w640.webp"), true);
  assert.equal(isInfoSpotOwnedR2Key("photo-variants/184022/preview_wm_v7.jpg"), false);
  assert.equal(isInfoSpotOwnedR2Key("albums/670/original.jpg"), false);

  const key = resolveClfPhotoSourceKey({
    originalKey: "albums/1/original.jpg",
    previewUrl: "https://pub-clf.example.r2.dev/albums/1/preview.jpg",
    previewWatermarkedKey: "photo-variants/9/preview_wm_v7.jpg",
    thumbWatermarkedKey: "photo-variants/9/thumb_wm_v7.jpg",
  });
  assert.equal(key, "albums/1/original.jpg");

  const previewKey = resolveClfPhotoPreviewSourceKey({
    originalKey: "albums/1/original.jpg",
    previewUrl: "https://pub-clf.example.r2.dev/albums/1/preview.jpg",
    previewWatermarkedKey: "photo-variants/9/preview_wm_v7.jpg",
    thumbWatermarkedKey: "photo-variants/9/thumb_wm_v7.jpg",
  });
  assert.equal(previewKey, "photo-variants/9/preview_wm_v7.jpg");

  console.log("r2-read tests: ok");
} finally {
  restoreEnv();
}
