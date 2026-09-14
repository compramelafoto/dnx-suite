import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { purchaseButtonState } from "./purchase-button-label";

describe("el botón de comprar, con fotos y videos", () => {
  it("sin nada elegido invita a elegir y está apagado", () => {
    const b = purchaseButtonState({ photos: 0, videos: 0 });
    assert.equal(b.label, "Seleccioná fotos o videos");
    assert.equal(b.disabled, true);
  });

  it("sólo fotos dice comprar fotos", () => {
    assert.equal(purchaseButtonState({ photos: 3, videos: 0 }).label, "Comprar 3 fotos");
  });

  it("una sola foto habla en singular", () => {
    assert.equal(purchaseButtonState({ photos: 1, videos: 0 }).label, "Comprar 1 foto");
  });

  it("sólo videos dice comprar videos", () => {
    assert.equal(purchaseButtonState({ photos: 0, videos: 2 }).label, "Comprar 2 videos");
    assert.equal(purchaseButtonState({ photos: 0, videos: 1 }).label, "Comprar 1 video");
  });

  it("fotos y videos juntos lo dice explícito", () => {
    // Es lo que evita que el cliente crea que está pagando sólo una parte.
    assert.equal(
      purchaseButtonState({ photos: 2, videos: 1 }).label,
      "Comprar 2 fotos y 1 video"
    );
    assert.equal(
      purchaseButtonState({ photos: 1, videos: 3 }).label,
      "Comprar 1 foto y 3 videos"
    );
  });

  it("con algo elegido, el botón se enciende", () => {
    assert.equal(purchaseButtonState({ photos: 0, videos: 1 }).disabled, false);
    assert.equal(purchaseButtonState({ photos: 1, videos: 0 }).disabled, false);
    assert.equal(purchaseButtonState({ photos: 1, videos: 1 }).disabled, false);
  });

  it("mientras procesa, lo dice y no deja tocar de nuevo", () => {
    const b = purchaseButtonState({ photos: 1, videos: 1, submitting: true });
    assert.equal(b.label, "Procesando...");
    assert.equal(b.disabled, true);
  });

  it("si el álbum no vende videos, el texto no los menciona", () => {
    // Aunque quedara algo viejo en el carrito, no se le ofrece al cliente.
    const b = purchaseButtonState({ photos: 2, videos: 5, videosEnabled: false });
    assert.equal(b.label, "Comprar 2 fotos");
  });

  it("sin videos habilitados y sin fotos, vuelve al texto de siempre", () => {
    const b = purchaseButtonState({ photos: 0, videos: 0, videosEnabled: false });
    assert.equal(b.label, "Seleccioná fotos");
  });

  it("números raros no rompen el botón", () => {
    const b = purchaseButtonState({ photos: Number.NaN, videos: -3 });
    assert.equal(b.disabled, true);
  });
});
