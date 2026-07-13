/**
 * Tests del contrato de previews editoriales.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial-photo-previews/editorial-photo-previews.test.ts
 */

import assert from "node:assert/strict";
import {
  buildClfThumbApiPath,
  canSelectEditorialPhoto,
  isSafeEditorialPreviewUrl,
  toEditorialPhotoPreview,
} from "./index";
import { urlToR2Key } from "./url-to-r2-key";

// 1. Preview path válido incluye albumId
{
  const path = buildClfThumbApiPath(42, 7);
  assert.equal(path, "/api/redaccion/clf-photos/42/thumb?albumId=7");
  assert.equal(isSafeEditorialPreviewUrl(path), true);
}

// 2. Preview inválida / keys / URLs externas rechazadas
{
  assert.equal(isSafeEditorialPreviewUrl(null), false);
  assert.equal(isSafeEditorialPreviewUrl(""), false);
  assert.equal(isSafeEditorialPreviewUrl("photos/abc/original.jpg"), false);
  assert.equal(isSafeEditorialPreviewUrl("https://r2.example/key.jpg"), false);
  assert.equal(isSafeEditorialPreviewUrl("/api/redaccion/clf-photos/1/thumb"), true);
}

// 3. View model no expone storage keys
{
  const preview = toEditorialPhotoPreview({
    photoId: 10,
    albumId: 3,
    photographerName: "Ana",
    albumName: "Maratón",
  });
  assert.equal(preview.photographerName, "Ana");
  assert.equal(preview.albumName, "Maratón");
  assert.ok(preview.previewUrl?.includes("albumId=3"));
  assert.equal(preview.status, "READY");
  const serialized = JSON.stringify(preview);
  assert.equal(serialized.includes("originalKey"), false);
  assert.equal(serialized.includes("storage"), false);
  assert.equal(canSelectEditorialPhoto(preview), true);
}

// 4. Foto no validada no seleccionable
{
  const bad = toEditorialPhotoPreview({
    photoId: 0,
    albumId: 0,
    photographerName: "X",
  });
  assert.equal(bad.previewUrl, null);
  assert.equal(bad.status, "UNAVAILABLE");
  assert.equal(canSelectEditorialPhoto(bad), false);
}

// 5. urlToR2Key no deja URL absoluta como key
{
  assert.equal(urlToR2Key("photos/a/b.jpg"), "photos/a/b.jpg");
  assert.equal(
    urlToR2Key("https://cdn.example.com/photos/a/b.jpg"),
    "photos/a/b.jpg",
  );
}

// 6. buildClfThumbApiPath rechaza ids inválidos
{
  assert.throws(() => buildClfThumbApiPath("x", 1));
  assert.throws(() => buildClfThumbApiPath(1, -1));
}

console.log("editorial-photo-previews tests: ok");
