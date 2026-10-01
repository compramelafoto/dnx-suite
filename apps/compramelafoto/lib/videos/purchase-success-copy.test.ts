import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { purchasedThingsLabel } from "./purchase-success-copy";

describe("cómo se le nombra al cliente lo que compró", () => {
  it("sólo fotos", () => {
    assert.equal(purchasedThingsLabel({ photos: 3, videos: 0 }), "tus fotos");
  });

  it("sólo un video", () => {
    // Antes decía "tus fotos" a quien había comprado un video.
    assert.equal(purchasedThingsLabel({ photos: 0, videos: 1 }), "tu video");
  });

  it("varios videos", () => {
    assert.equal(purchasedThingsLabel({ photos: 0, videos: 2 }), "tus videos");
  });

  it("fotos y videos juntos", () => {
    assert.equal(purchasedThingsLabel({ photos: 2, videos: 1 }), "tus fotos y tu video");
    assert.equal(purchasedThingsLabel({ photos: 2, videos: 3 }), "tus fotos y tus videos");
  });

  it("sin datos usa el término general, nunca queda vacío", () => {
    assert.equal(purchasedThingsLabel({ photos: 0, videos: 0 }), "tu compra");
  });

  it("números inválidos no rompen el texto", () => {
    assert.equal(
      purchasedThingsLabel({ photos: Number.NaN, videos: -1 }),
      "tu compra"
    );
  });
});
