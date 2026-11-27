import { test } from "node:test";
import assert from "node:assert/strict";
import { canBuyFromAlbumLink, canOpenAlbumGallery } from "./album-helpers";

test("álbum público: se puede comprar", () => {
  assert.equal(canBuyFromAlbumLink({ isPublic: true, isHidden: false }), true);
});

test("álbum privado con link: se puede comprar (antes daba «fotos no disponibles»)", () => {
  assert.equal(canBuyFromAlbumLink({ isPublic: false, isHidden: false }), true);
});

test("álbum oculto: no se puede comprar, sea público o privado", () => {
  assert.equal(canBuyFromAlbumLink({ isPublic: true, isHidden: true }), false);
  assert.equal(canBuyFromAlbumLink({ isPublic: false, isHidden: true }), false);
});

test("si la galería deja ver un álbum no oculto, también deja comprar", () => {
  const recien = new Date();
  for (const isPublic of [true, false]) {
    const album = { isPublic, isHidden: false, createdAt: recien };
    assert.equal(canOpenAlbumGallery(album), canBuyFromAlbumLink(album));
  }
});
