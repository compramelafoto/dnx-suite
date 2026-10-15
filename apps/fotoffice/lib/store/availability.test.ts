import { describe, expect, it } from "vitest";
import { availableQty, effectiveUnitPriceMinor } from "./availability";

describe("availableQty", () => {
  it("resta lo reservado", () => expect(availableQty({ stockQty: 5, tracksStock: true, reservedQty: 2 })).toBe(3));
  it("nunca da negativo aunque el mostrador haya dejado el stock en rojo", () =>
    expect(availableQty({ stockQty: -2, tracksStock: true, reservedQty: 1 })).toBe(0));
  it("sin control de stock es ilimitado", () =>
    expect(availableQty({ stockQty: 0, tracksStock: false, reservedQty: 9 })).toBeNull());
});

describe("effectiveUnitPriceMinor", () => {
  it("hereda el del producto", () => expect(effectiveUnitPriceMinor(1000, null)).toBe(1000));
  it("la variante manda si tiene precio", () => expect(effectiveUnitPriceMinor(1000, 1500)).toBe(1500));
  it("un precio de variante en cero es válido", () => expect(effectiveUnitPriceMinor(1000, 0)).toBe(0));
});
