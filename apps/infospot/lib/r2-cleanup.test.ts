/**
 * Tests política de keys R2 Info Spot (sin Prisma / sin red).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/r2-cleanup.test.ts
 */

import assert from "node:assert/strict";
import {
  INFOSPOT_R2_DELETE_BATCH_MAX,
  assertInfoSpotDeletableR2Key,
  assertSafeR2Key,
  collectEditorialPhotoInfoSpotKeys,
  isInfoSpotOwnedR2Key,
} from "./r2-key-policy";

// 1. Safe key basics
{
  assert.equal(assertSafeR2Key("infospot/covers/a.jpg"), "infospot/covers/a.jpg");
  assert.throws(() => assertSafeR2Key("https://evil.example/a.jpg"));
  assert.throws(() => assertSafeR2Key("../etc/passwd"));
  assert.throws(() => assertSafeR2Key(""));
}

// 2. Namespace Info Spot allowlist
{
  assert.equal(isInfoSpotOwnedR2Key("infospot/covers/x.jpg"), true);
  assert.equal(isInfoSpotOwnedR2Key("infospot/editorial/clf/1/w640.webp"), true);
  assert.equal(isInfoSpotOwnedR2Key("infospot/events/pending/a.jpg"), true);
  assert.equal(isInfoSpotOwnedR2Key("infospot/avatars/9/a.jpg"), true);
  assert.equal(isInfoSpotOwnedR2Key("albums/684/original.jpg"), false);
  assert.equal(isInfoSpotOwnedR2Key("photo-variants/1/preview_wm.jpg"), false);
  assert.equal(isInfoSpotOwnedR2Key("infospot/../albums/x"), false);
  assert.throws(() => assertInfoSpotDeletableR2Key("albums/1/a.jpg"));
  assert.throws(() => assertInfoSpotDeletableR2Key("photo-variants/1/a.jpg"));
  assert.equal(
    assertInfoSpotDeletableR2Key("infospot/covers/smoke.jpg"),
    "infospot/covers/smoke.jpg",
  );
}

// 3. Collect keys: omite source CLF, incluye derivados Info Spot
{
  const keys = collectEditorialPhotoInfoSpotKeys({
    sourceStorageKey: "photo-variants/182795/preview_wm_v7.jpg",
    editorialMasterKey: "infospot/editorial/clf/182795/w1280.webp",
    variants: [
      { r2Key: "infospot/editorial/clf/182795/w640.webp" },
      { r2Key: "infospot/editorial/clf/182795/w1280.webp" },
    ],
    deliveryAsset: { r2Key: "infospot/editorial/clf/182795/w1280.webp" },
  });
  assert.deepEqual(
    keys.sort(),
    [
      "infospot/editorial/clf/182795/w1280.webp",
      "infospot/editorial/clf/182795/w640.webp",
    ].sort(),
  );
  assert.equal(keys.includes("photo-variants/182795/preview_wm_v7.jpg"), false);
}

// 4. Collect keys: source Info Spot (smoke/upload) sí se incluye
{
  const keys = collectEditorialPhotoInfoSpotKeys({
    sourceStorageKey: "infospot/covers/smoke.jpg",
    editorialMasterKey: "infospot/editorial/clf/smoke/w128.webp",
    variants: [{ r2Key: "infospot/editorial/clf/smoke/w128.webp" }],
    deliveryAsset: null,
  });
  assert.equal(keys.includes("infospot/covers/smoke.jpg"), true);
  assert.equal(keys.includes("infospot/editorial/clf/smoke/w128.webp"), true);
}

// 5. Batch max constant
{
  assert.equal(INFOSPOT_R2_DELETE_BATCH_MAX, 32);
}

console.log("r2-cleanup.test.ts: ok");
