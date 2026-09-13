import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { addVideosToOrderTotals } from "./mixed-order-totals";

const sinVideos = { items: [], clientTotalArs: 0, feeTotalArs: 0 };

describe("addVideosToOrderTotals", () => {
  it("SIN videos no cambia ni un peso del pedido de fotos", () => {
    // Esta es la garantía que protege la venta de fotos: si el cliente no eligió
    // videos, el total y el fee tienen que salir exactamente iguales que antes.
    const r = addVideosToOrderTotals({
      photoTotalArs: 7_350,
      photoMarketplaceFeeArs: 950,
      videoQuote: sinVideos,
    });
    assert.equal(r.totalArs, 7_350);
    assert.equal(r.marketplaceFeeArs, 950);
    assert.equal(r.hasVideos, false);
  });

  it("con un quote nulo tampoco toca nada", () => {
    const r = addVideosToOrderTotals({
      photoTotalArs: 5_000,
      photoMarketplaceFeeArs: 650,
      videoQuote: null,
    });
    assert.equal(r.totalArs, 5_000);
    assert.equal(r.marketplaceFeeArs, 650);
  });

  it("suma el video al total y su fee al fee", () => {
    const r = addVideosToOrderTotals({
      photoTotalArs: 7_350,
      photoMarketplaceFeeArs: 950,
      videoQuote: { items: [{ videoId: 1 }], clientTotalArs: 11_500, feeTotalArs: 1_500 },
    });
    assert.equal(r.totalArs, 7_350 + 11_500);
    assert.equal(r.marketplaceFeeArs, 950 + 1_500);
    assert.equal(r.hasVideos, true);
  });

  it("un pedido de sólo videos también funciona", () => {
    const r = addVideosToOrderTotals({
      photoTotalArs: 0,
      photoMarketplaceFeeArs: 0,
      videoQuote: { items: [{ videoId: 9 }], clientTotalArs: 3_450, feeTotalArs: 450 },
    });
    assert.equal(r.totalArs, 3_450);
    assert.equal(r.marketplaceFeeArs, 450);
  });

  it("el fee nunca puede superar el total: sería repartir más de lo cobrado", () => {
    const r = addVideosToOrderTotals({
      photoTotalArs: 1_000,
      photoMarketplaceFeeArs: 900,
      videoQuote: { items: [{ videoId: 1 }], clientTotalArs: 100, feeTotalArs: 500 },
    });
    assert.ok(
      r.marketplaceFeeArs <= r.totalArs,
      `el fee (${r.marketplaceFeeArs}) no puede pasar el total (${r.totalArs})`
    );
  });

  it("redondea a pesos enteros, como el resto de los pedidos", () => {
    const r = addVideosToOrderTotals({
      photoTotalArs: 1_000.4,
      photoMarketplaceFeeArs: 130.6,
      videoQuote: { items: [{ videoId: 1 }], clientTotalArs: 11_500, feeTotalArs: 1_500 },
    });
    assert.equal(Number.isInteger(r.totalArs), true);
    assert.equal(Number.isInteger(r.marketplaceFeeArs), true);
  });

  it("valores inválidos no generan NaN en un pedido", () => {
    const r = addVideosToOrderTotals({
      photoTotalArs: Number.NaN,
      photoMarketplaceFeeArs: Number.NaN,
      videoQuote: sinVideos,
    });
    assert.equal(r.totalArs, 0);
    assert.equal(r.marketplaceFeeArs, 0);
  });
});
