import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productsForAlbum } from "./album-scoped-products";

const goethe = { id: 1, albumId: null };
const goethe2 = { id: 2, albumId: null };
const sanPatricio = { id: 3, albumId: 50 };

describe("productsForAlbum", () => {
  it("un álbum con productos propios ofrece sólo esos", () => {
    assert.deepEqual(productsForAlbum([goethe, goethe2, sanPatricio], 50), [sanPatricio]);
  });

  it("un álbum sin productos propios ofrece los generales, no los de otro álbum", () => {
    assert.deepEqual(productsForAlbum([goethe, goethe2, sanPatricio], 7), [goethe, goethe2]);
  });

  it("fuera de un álbum sólo van los generales", () => {
    assert.deepEqual(productsForAlbum([goethe, sanPatricio], null), [goethe]);
    assert.deepEqual(productsForAlbum([goethe, sanPatricio]), [goethe]);
  });

  it("los productos sin la columna cargada cuentan como generales", () => {
    const viejo = { id: 9 } as { id: number; albumId?: number | null };
    assert.deepEqual(productsForAlbum([viejo], 50), [viejo]);
  });
});
