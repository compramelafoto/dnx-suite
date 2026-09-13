import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { publicVideoPrice, formatVideoPriceArs } from "./public-video-price";

describe("publicVideoPrice", () => {
  it("muestra el precio CON el 15% incluido: es lo que va a pagar", () => {
    // El cliente nunca tiene que ver el precio del fotógrafo y después una
    // sorpresa en el checkout.
    const p = publicVideoPrice({ priceCents: 1_000_000, sellEnabled: true }, 15);
    assert.equal(p.priceArs, 11_500);
    assert.equal(p.purchasable, true);
  });

  it("no expone el precio del fotógrafo ni el fee", () => {
    const p = publicVideoPrice({ priceCents: 1_000_000, sellEnabled: true }, 15);
    assert.deepEqual(Object.keys(p).sort(), ["priceArs", "priceLabel", "purchasable"]);
  });

  it("un video fuera de venta no muestra precio ni se puede comprar", () => {
    const p = publicVideoPrice({ priceCents: 1_000_000, sellEnabled: false }, 15);
    assert.equal(p.priceArs, null);
    assert.equal(p.purchasable, false);
    assert.equal(p.priceLabel, null);
  });

  it("un video sin precio configurado no se puede comprar", () => {
    const p = publicVideoPrice({ priceCents: 0, sellEnabled: true }, 15);
    assert.equal(p.purchasable, false);
  });

  it("sin fee el cliente paga el precio del fotógrafo", () => {
    const p = publicVideoPrice({ priceCents: 500_000, sellEnabled: true }, 0);
    assert.equal(p.priceArs, 5_000);
  });
});

describe("formatVideoPriceArs", () => {
  it("usa el formato de pesos argentinos con separador de miles", () => {
    assert.equal(formatVideoPriceArs(11_500), "$11.500");
    assert.equal(formatVideoPriceArs(3_450), "$3.450");
    assert.equal(formatVideoPriceArs(920_000), "$920.000");
  });

  it("no muestra centavos: los pedidos son en pesos enteros", () => {
    assert.equal(formatVideoPriceArs(11_500.6), "$11.501");
  });

  it("un precio nulo no se muestra", () => {
    assert.equal(formatVideoPriceArs(null), null);
    assert.equal(formatVideoPriceArs(0), null);
  });
});
