import { describe, expect, it } from "vitest";
import { bundleLabel, computeBundleDiscount } from "./bundle";

const promo = { qty: 2, priceMinor: 6_000_000 };
const remera = (qty: number) => [{ unitPriceMinor: 3_500_000, qty }];

describe("computeBundleDiscount", () => {
  it("2 remeras de $35.000 pagan $60.000", () => {
    expect(computeBundleDiscount(promo, remera(2))).toEqual({ discountMinor: 1_000_000, groups: 1 });
  });
  it("con 3, la que sobra paga precio de lista", () => {
    expect(computeBundleDiscount(promo, remera(3))).toEqual({ discountMinor: 1_000_000, groups: 1 });
  });
  it("con 4, dos grupos", () => {
    expect(computeBundleDiscount(promo, remera(4))).toEqual({ discountMinor: 2_000_000, groups: 2 });
  });
  it("con 1, nada", () => {
    expect(computeBundleDiscount(promo, remera(1))).toEqual({ discountMinor: 0, groups: 0 });
  });
  it("sin promo, nada", () => {
    expect(computeBundleDiscount(null, remera(4))).toEqual({ discountMinor: 0, groups: 0 });
  });
  it("agrupa de mayor a menor precio, mezclando productos", () => {
    // 40.000 + 35.000 → 60.000 (descuento 15.000); 30.000 sobra.
    const r = computeBundleDiscount(promo, [
      { unitPriceMinor: 3_000_000, qty: 1 },
      { unitPriceMinor: 4_000_000, qty: 1 },
      { unitPriceMinor: 3_500_000, qty: 1 },
    ]);
    expect(r).toEqual({ discountMinor: 1_500_000, groups: 1 });
  });
  it("nunca encarece: un grupo que suma menos que la promo paga su suma", () => {
    expect(computeBundleDiscount(promo, [{ unitPriceMinor: 2_000_000, qty: 2 }])).toEqual({ discountMinor: 0, groups: 1 });
  });
  it("una promo mal formada no descuenta", () => {
    expect(computeBundleDiscount({ qty: 1, priceMinor: 100 }, remera(4)).discountMinor).toBe(0);
    expect(computeBundleDiscount({ qty: 2, priceMinor: 0 }, remera(4)).discountMinor).toBe(0);
  });
});

describe("bundleLabel", () => {
  const fmt = (m: number) => `$${m / 100}`;
  it("usa el texto propio", () => {
    expect(bundleLabel({ ...promo, label: " 2x60 " }, fmt)).toBe("2x60");
  });
  it("arma el texto por defecto", () => {
    expect(bundleLabel({ ...promo, label: null }, fmt)).toBe("Llevá 2 por $60000");
  });
});
