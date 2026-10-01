import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VIDEO_PRICE_CENTS_PER_ARS,
  quoteVideoForCheckout,
  videoBasePriceArs,
} from "./video-order-pricing";

describe("videoBasePriceArs", () => {
  it("convierte los centavos del video a los pesos enteros que usa la orden", () => {
    // VideoAsset.priceCents guarda centavos reales: 1.000.000 = $10.000.
    // Order.totalCents guarda pesos enteros: $10.000 = 10.000.
    // Confundirlos multiplicaría el precio por 100.
    assert.equal(videoBasePriceArs({ priceCents: 1_000_000 }), 10_000);
    assert.equal(videoBasePriceArs({ priceCents: 300_000 }), 3_000);
    assert.equal(videoBasePriceArs({ priceCents: 800_000 }), 8_000);
  });

  it("el factor de conversión es explícito y no un 100 perdido en el código", () => {
    assert.equal(VIDEO_PRICE_CENTS_PER_ARS, 100);
  });

  it("redondea los centavos sueltos al peso más cercano", () => {
    assert.equal(videoBasePriceArs({ priceCents: 350_050 }), 3_501);
    assert.equal(videoBasePriceArs({ priceCents: 350_049 }), 3_500);
  });

  it("un precio inválido da cero en vez de NaN", () => {
    assert.equal(videoBasePriceArs({ priceCents: 0 }), 0);
    assert.equal(videoBasePriceArs({ priceCents: -500 }), 0);
    assert.equal(videoBasePriceArs({ priceCents: Number.NaN }), 0);
  });
});

describe("quoteVideoForCheckout", () => {
  it("el 15% es un recargo sobre el precio del fotógrafo, no una quita", () => {
    // El fotógrafo pidió $10.000: cobra $10.000 y el cliente paga $11.500.
    const q = quoteVideoForCheckout({ priceCents: 1_000_000 }, 15);
    assert.equal(q.basePriceArs, 10_000, "lo que cobra el fotógrafo");
    assert.equal(q.feeArs, 1_500, "lo que queda para la plataforma");
    assert.equal(q.clientTotalArs, 11_500, "lo que paga el cliente");
  });

  it("la cuenta siempre cierra: base + fee = total", () => {
    for (const cents of [300_000, 500_000, 777_777, 1_000_000, 8_000_000]) {
      const q = quoteVideoForCheckout({ priceCents: cents }, 15);
      assert.equal(
        q.basePriceArs + q.feeArs,
        q.clientTotalArs,
        `no cierra con ${cents} centavos`
      );
    }
  });

  it("usa la misma fórmula que las fotos: el fee sale del precio base", () => {
    // Si se calculara como 15% del total sería 1.725, no 1.500.
    const q = quoteVideoForCheckout({ priceCents: 1_000_000 }, 15);
    assert.notEqual(q.feeArs, 1_725);
    assert.equal(q.feeArs, Math.round(q.basePriceArs * 0.15));
  });

  it("sin fee, el cliente paga exactamente el precio del fotógrafo", () => {
    const q = quoteVideoForCheckout({ priceCents: 500_000 }, 0);
    assert.equal(q.basePriceArs, 5_000);
    assert.equal(q.feeArs, 0);
    assert.equal(q.clientTotalArs, 5_000);
  });

  it("un video sin precio no se puede cobrar", () => {
    const q = quoteVideoForCheckout({ priceCents: 0 }, 15);
    assert.equal(q.clientTotalArs, 0);
    assert.equal(q.sellable, false);
  });

  it("marca como vendible sólo lo que tiene precio", () => {
    assert.equal(quoteVideoForCheckout({ priceCents: 300_000 }, 15).sellable, true);
  });
});
