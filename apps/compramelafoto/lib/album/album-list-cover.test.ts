/**
 * ../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.json --test lib/album/album-list-cover.test.ts
 *
 * Portada propia: imagen subida por el fotógrafo que NO es una foto del álbum.
 * Debe verse en los listados sin desactivar el cartel “fotos próximamente”.
 */

process.env.R2_PUBLIC_URL = "https://cdn.example.test";

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasAlbumStandaloneCover,
  resolveAlbumStandaloneCoverUrl,
  resolveAlbumListCoverUrl,
  resolveAlbumListCoverUrlFallback,
  shouldShowAlbumComingSoonCover,
} from "./album-list-cover";

const STANDALONE_KEY = "album-covers/7/cover_abc.jpg";

test("portada propia: sin fotos y sin coverPhotoId", () => {
  const album = { id: 7, coverPhotoId: null, coverThumbnailKey: STANDALONE_KEY, photosCount: 0 };

  assert.equal(hasAlbumStandaloneCover(album), true);
  assert.equal(
    resolveAlbumStandaloneCoverUrl(album),
    `https://cdn.example.test/${STANDALONE_KEY}`
  );
  assert.equal(resolveAlbumListCoverUrl(album), `https://cdn.example.test/${STANDALONE_KEY}`);
  // Sin fotos no hay foto de respaldo posible.
  assert.equal(resolveAlbumListCoverUrlFallback(album, resolveAlbumListCoverUrl(album)), null);
});

test("la portada propia no cuenta como foto subida", () => {
  // El cartel “próximamente” del álbum público depende de la cantidad de fotos,
  // y la portada propia no crea ninguna.
  const album = { id: 7, coverPhotoId: null, coverThumbnailKey: STANDALONE_KEY, photosCount: 0 };
  assert.equal(album.photosCount, 0);
  // En los listados sí se muestra la imagen en vez del placeholder.
  assert.equal(shouldShowAlbumComingSoonCover(0, hasAlbumStandaloneCover(album)), false);
  assert.equal(shouldShowAlbumComingSoonCover(0, false), true);
  assert.equal(shouldShowAlbumComingSoonCover(3, false), false);
});

test("portada elegida entre las fotos: gana la miniatura recortada", () => {
  const album = {
    id: 7,
    coverPhotoId: 42,
    coverThumbnailKey: "album-covers/7/cover_42.jpg",
    coverPhoto: { id: 42, isRemoved: false },
    photosCount: 5,
  };
  assert.equal(hasAlbumStandaloneCover(album), false);
  assert.equal(resolveAlbumStandaloneCoverUrl(album), null);
  assert.equal(
    resolveAlbumListCoverUrl(album),
    "https://cdn.example.test/album-covers/7/cover_42.jpg"
  );
});

test("sin portada elegida se usa la primera foto activa", () => {
  const album = {
    id: 7,
    coverPhotoId: null,
    coverThumbnailKey: null,
    fallbackCoverPhoto: { id: 99, isRemoved: false },
    photosCount: 5,
  };
  assert.equal(hasAlbumStandaloneCover(album), false);
  const url = resolveAlbumListCoverUrl(album);
  assert.ok(url && url.includes("/api/photos/99/view"), url ?? "sin url");
});

test("portada propia con fotos ya subidas: la imagen manda y hay respaldo por API", () => {
  const album = {
    id: 7,
    coverPhotoId: null,
    coverThumbnailKey: STANDALONE_KEY,
    fallbackCoverPhoto: { id: 99, isRemoved: false },
    photosCount: 5,
  };
  const primary = resolveAlbumListCoverUrl(album);
  assert.equal(primary, `https://cdn.example.test/${STANDALONE_KEY}`);
  const fallback = resolveAlbumListCoverUrlFallback(album, primary);
  assert.ok(fallback && fallback.includes("/api/photos/99/view"), fallback ?? "sin fallback");
});
