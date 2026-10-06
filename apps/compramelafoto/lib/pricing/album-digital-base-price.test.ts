import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAlbumDigitalBasePesos } from "@/lib/pricing/album-digital-base-price";

const OWNER = 898;
const COLLAB = 77;

function resolve(overrides: Partial<Parameters<typeof resolveAlbumDigitalBasePesos>[0]>) {
  return resolveAlbumDigitalBasePesos({
    uploaderId: OWNER,
    albumOwnerUserId: OWNER,
    albumDigitalStoredRaw: 6000,
    uploaderDigitalMap: new Map([
      [OWNER, 3000],
      [COLLAB, 4500],
    ]),
    albumDigitalNormalizedFallback: 6000,
    photographerDigitalFallback: null,
    ...overrides,
  });
}

describe("resolveAlbumDigitalBasePesos", () => {
  it("álbum propio con precio cargado: manda el precio del álbum, no el default del dueño (caso álbum 1045)", () => {
    assert.equal(resolve({}), 6000);
  });

  it("álbum propio sin precio cargado: usa el default del dueño", () => {
    assert.equal(
      resolve({ albumDigitalStoredRaw: null, albumDigitalNormalizedFallback: 3000 }),
      3000
    );
    assert.equal(resolve({ albumDigitalStoredRaw: 0, albumDigitalNormalizedFallback: 3000 }), 3000);
  });

  it("álbum colaborativo: la foto de otro fotógrafo usa su propio default", () => {
    assert.equal(resolve({ uploaderId: COLLAB }), 4500);
  });

  it("sin datos del que subió: cae al precio normalizado del álbum", () => {
    assert.equal(resolve({ uploaderId: 12345 }), 6000);
    assert.equal(resolve({ uploaderId: null }), 6000);
  });

  it("si todo da 0 usa el respaldo del fotógrafo", () => {
    assert.equal(
      resolve({
        uploaderId: null,
        albumDigitalStoredRaw: null,
        albumDigitalNormalizedFallback: 0,
        photographerDigitalFallback: 5000,
      }),
      5000
    );
  });
});
