import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  orderNeedsDigitalDelivery,
  shouldEmailDownloadRightAway,
} from "./order-needs-delivery";

describe("a quién hay que entregarle la descarga", () => {
  it("un pedido de sólo video SÍ recibe su link", () => {
    // El caso que falló de verdad: pedido 3278, un video, cero fotos. Se cobró
    // y no se entregó nada.
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: 0, videoCount: 1 }),
      true
    );
  });

  it("un pedido de sólo fotos digitales recibe su link", () => {
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: 3, videoCount: 0 }),
      true
    );
  });

  it("fotos y videos en el mismo pedido reciben un único link", () => {
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: 2, videoCount: 1 }),
      true
    );
  });

  it("un pedido de sólo fotos impresas no genera descarga", () => {
    // Acá no hay nada que descargar: la entrega es el papel.
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: 0, videoCount: 0 }),
      false
    );
  });

  it("números inválidos no habilitan una descarga vacía", () => {
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: Number.NaN, videoCount: 0 }),
      false
    );
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: -3, videoCount: -1 }),
      false
    );
  });

  it("un video vale tanto como una foto: ninguno de los dos manda solo", () => {
    // Si alguien vuelve a escribir la condición mirando una sola de las dos
    // cosas, uno de estos dos casos se cae.
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: 1, videoCount: 0 }),
      true
    );
    assert.equal(
      orderNeedsDigitalDelivery({ digitalPhotoCount: 0, videoCount: 1 }),
      true
    );
  });
});

describe("cuándo el correo de descarga sale en el momento", () => {
  it("sólo video: sale ya, porque no hay ZIP que esperar", () => {
    // La otra mitad del pedido 3278: el token se creaba, pero el correo salía
    // recién al terminar el ZIP de las fotos, y un pedido de sólo video no
    // arma ninguno. El cliente nunca se enteraba.
    assert.equal(
      shouldEmailDownloadRightAway({ digitalPhotoCount: 0, videoCount: 1 }),
      true
    );
  });

  it("con fotos NO sale acá: lo manda el ZIP y llegaría duplicado", () => {
    assert.equal(
      shouldEmailDownloadRightAway({ digitalPhotoCount: 2, videoCount: 1 }),
      false
    );
    assert.equal(
      shouldEmailDownloadRightAway({ digitalPhotoCount: 2, videoCount: 0 }),
      false
    );
  });

  it("sin nada que descargar no se manda ningún correo", () => {
    assert.equal(
      shouldEmailDownloadRightAway({ digitalPhotoCount: 0, videoCount: 0 }),
      false
    );
  });

  it("números inválidos no disparan un correo vacío", () => {
    assert.equal(
      shouldEmailDownloadRightAway({ digitalPhotoCount: 0, videoCount: Number.NaN }),
      false
    );
  });
});
