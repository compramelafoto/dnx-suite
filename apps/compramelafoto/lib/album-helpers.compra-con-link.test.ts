import { test } from "node:test";
import assert from "node:assert/strict";
import { isAlbumOpenByLink, canOpenAlbumGallery } from "./album-helpers";

test("álbum público: se puede buscar y comprar", () => {
  assert.equal(isAlbumOpenByLink({ isPublic: true, isHidden: false }), true);
});

test("álbum privado con link: se puede buscar y comprar (antes daba «fotos no disponibles»)", () => {
  assert.equal(isAlbumOpenByLink({ isPublic: false, isHidden: false }), true);
});

test("álbum oculto: no se puede buscar ni comprar, sea público o privado", () => {
  assert.equal(isAlbumOpenByLink({ isPublic: true, isHidden: true }), false);
  assert.equal(isAlbumOpenByLink({ isPublic: false, isHidden: true }), false);
});

test("si la galería deja ver un álbum no oculto, también deja buscar y comprar", () => {
  const recien = new Date();
  for (const isPublic of [true, false]) {
    const album = { isPublic, isHidden: false, createdAt: recien };
    assert.equal(canOpenAlbumGallery(album), isAlbumOpenByLink(album));
  }
});
