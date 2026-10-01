import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VIDEO_CATEGORIES,
  VIDEO_DEFAULT_PRICE_CENTS,
  VIDEO_MIN_PRICE_CENTS_BY_CATEGORY,
} from "./video-validation";
import { publicVideoPrice } from "./public-video-price";

describe("mínimos de venta de video", () => {
  it("el precio por defecto supera TODOS los mínimos", () => {
    // Si el default quedara por debajo de algún mínimo, al fotógrafo que sube
    // esa categoría le aparecería un precio que el sistema le rechaza.
    for (const cat of VIDEO_CATEGORIES) {
      const min = VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[cat];
      assert.ok(
        VIDEO_DEFAULT_PRICE_CENTS >= min,
        `el default (${VIDEO_DEFAULT_PRICE_CENTS}) es menor que el mínimo de ${cat} (${min})`
      );
    }
  });

  it("toda categoría tiene un mínimo definido y positivo", () => {
    for (const cat of VIDEO_CATEGORIES) {
      const min = VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[cat];
      assert.equal(typeof min, "number", `${cat} sin mínimo`);
      assert.ok(min > 0, `${cat} con mínimo inválido: ${min}`);
    }
  });

  it("los mínimos están en centavos, no en pesos", () => {
    // Un mínimo de 9.000 en vez de 900.000 significaría cobrar $90.
    for (const cat of VIDEO_CATEGORIES) {
      assert.ok(
        VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[cat] >= 100_000,
        `el mínimo de ${cat} parece estar en pesos y no en centavos`
      );
    }
  });

  it("los valores acordados el 13/09/2026", () => {
    assert.equal(VIDEO_MIN_PRICE_CENTS_BY_CATEGORY.REEL, 900_000, "reel $9.000");
    assert.equal(VIDEO_MIN_PRICE_CENTS_BY_CATEGORY.CEREMONY, 2_400_000, "ceremonia $24.000");
    assert.equal(VIDEO_MIN_PRICE_CENTS_BY_CATEGORY.SCHOOL, 1_500_000, "escolar $15.000");
    assert.equal(VIDEO_DEFAULT_PRICE_CENTS, 3_000_000, "default $30.000");
  });

  it("lo que ve el cliente en el mínimo de ceremonia, con el 15%", () => {
    // $24.000 del fotógrafo → $27.600 que paga el cliente.
    const p = publicVideoPrice(
      { priceCents: VIDEO_MIN_PRICE_CENTS_BY_CATEGORY.CEREMONY, sellEnabled: true },
      15
    );
    assert.equal(p.priceArs, 27_600);
    assert.equal(p.priceLabel, "$27.600");
  });
});
