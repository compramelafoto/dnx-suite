import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { quoteVideoCart, type CartVideo } from "./video-cart";

const ahora = new Date("2026-09-13T12:00:00Z");

function v(over: Partial<CartVideo> = {}): CartVideo {
  return {
    id: 1,
    title: "Ceremonia",
    priceCents: 1_000_000,
    sellEnabled: true,
    isRemoved: false,
    processingStatus: "READY",
    expiresAt: new Date("2026-09-30T00:00:00Z"),
    ...over,
  };
}

describe("quoteVideoCart", () => {
  it("cotiza un video con el 15% de recargo", () => {
    const q = quoteVideoCart([v()], 15, ahora);
    assert.equal(q.items.length, 1);
    assert.equal(q.photographerTotalArs, 10_000);
    assert.equal(q.feeTotalArs, 1_500);
    assert.equal(q.clientTotalArs, 11_500);
    assert.deepEqual(q.rejected, []);
  });

  it("suma varios videos y la cuenta cierra", () => {
    const q = quoteVideoCart(
      [v({ id: 1, priceCents: 1_000_000 }), v({ id: 2, priceCents: 300_000 })],
      15,
      ahora
    );
    assert.equal(q.clientTotalArs, 11_500 + 3_450);
    assert.equal(q.photographerTotalArs + q.feeTotalArs, q.clientTotalArs);
  });

  it("rechaza un video que el fotógrafo sacó de la venta", () => {
    const q = quoteVideoCart([v({ sellEnabled: false })], 15, ahora);
    assert.equal(q.items.length, 0);
    assert.equal(q.clientTotalArs, 0);
    assert.equal(q.rejected[0]?.reason, "no está a la venta");
  });

  it("rechaza un video borrado", () => {
    const q = quoteVideoCart([v({ isRemoved: true })], 15, ahora);
    assert.equal(q.rejected[0]?.reason, "ya no está disponible");
  });

  it("rechaza un video que todavía se está procesando", () => {
    const q = quoteVideoCart([v({ processingStatus: "UPLOADED" })], 15, ahora);
    assert.equal(q.rejected[0]?.reason, "todavía se está procesando");
  });

  it("rechaza un video vencido: a los 15 días el archivo ya no existe", () => {
    const q = quoteVideoCart(
      [v({ expiresAt: new Date("2026-09-12T00:00:00Z") })],
      15,
      ahora
    );
    assert.equal(q.rejected[0]?.reason, "venció y ya no está disponible");
  });

  it("rechaza un video sin precio en vez de cobrar cero", () => {
    const q = quoteVideoCart([v({ priceCents: 0 })], 15, ahora);
    assert.equal(q.rejected[0]?.reason, "no tiene precio configurado");
    assert.equal(q.clientTotalArs, 0);
  });

  it("cobra lo válido e informa lo rechazado, sin mezclarlos", () => {
    const q = quoteVideoCart(
      [v({ id: 1 }), v({ id: 2, sellEnabled: false }), v({ id: 3, priceCents: 300_000 })],
      15,
      ahora
    );
    assert.deepEqual(
      q.items.map((i) => i.videoId),
      [1, 3]
    );
    assert.equal(q.rejected.length, 1);
    assert.equal(q.clientTotalArs, 11_500 + 3_450);
  });

  it("un carrito vacío no es cobrable", () => {
    const q = quoteVideoCart([], 15, ahora);
    assert.equal(q.clientTotalArs, 0);
    assert.equal(q.payable, false);
  });

  it("un carrito con todo rechazado no es cobrable", () => {
    const q = quoteVideoCart([v({ sellEnabled: false })], 15, ahora);
    assert.equal(q.payable, false);
  });

  it("congela el porcentaje de fee en cada línea, para auditar después", () => {
    const q = quoteVideoCart([v()], 15, ahora);
    assert.equal(q.items[0]?.feePercent, 15);
  });

  it("guarda el título: el video se borra a los 15 días y el pedido queda", () => {
    const q = quoteVideoCart([v({ title: "Casamiento Ana y Luis" })], 15, ahora);
    assert.equal(q.items[0]?.videoTitle, "Casamiento Ana y Luis");
  });

  it("no cobra dos veces el mismo video", () => {
    const q = quoteVideoCart([v({ id: 7 }), v({ id: 7 })], 15, ahora);
    assert.equal(q.items.length, 1);
    assert.equal(q.clientTotalArs, 11_500);
  });
});
