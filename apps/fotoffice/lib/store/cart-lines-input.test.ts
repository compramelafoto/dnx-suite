import { describe, expect, it } from "vitest";
import { parseCartLinesInput } from "./cart-lines-input";

describe("parseCartLinesInput", () => {
  it("acepta líneas del carrito y descarta campos de más", () => {
    expect(
      parseCartLinesInput([
        { productId: "p1", variantId: null, qty: 2, unitPriceMinor: 100, name: "Remera", slug: "x" },
        { productId: "p2", variantId: "v1", qty: 1 },
      ]),
    ).toEqual([
      { productId: "p1", variantId: null, qty: 2, unitPriceMinor: 100, name: "Remera" },
      { productId: "p2", variantId: "v1", qty: 1 },
    ]);
  });

  it("acepta líneas de obra y productos con kind", () => {
    expect(
      parseCartLinesInput([
        { kind: "artwork", artworkListingId: "l1", printFormatId: "f1", qty: 2, unitPriceMinor: 100, name: "Atardecer", slug: "x" },
        { kind: "product", productId: "p1", variantId: null, qty: 1 },
      ]),
    ).toEqual([
      { kind: "artwork", artworkListingId: "l1", printFormatId: "f1", qty: 2, unitPriceMinor: 100, name: "Atardecer" },
      { kind: "product", productId: "p1", variantId: null, qty: 1 },
    ]);
  });

  it.each([
    [{ kind: "artwork", artworkListingId: "", printFormatId: "f1", qty: 1 }],
    [{ kind: "artwork", artworkListingId: "l1", qty: 1 }],
    [{ kind: "artwork", artworkListingId: "l1", printFormatId: "f1", qty: 0 }],
    [{ kind: "otra", productId: "p", variantId: null, qty: 1 }],
  ])("rechaza obras mal formadas %j", (...raw) => {
    expect(parseCartLinesInput(raw)).toBeNull();
  });

  it.each([null, "x", {}, [{ productId: "" , variantId: null, qty: 1 }], [{ productId: "p", variantId: null, qty: 0 }], [{ productId: "p", variantId: null, qty: 1.5 }], [{ productId: "p", variantId: null, qty: 1, unitPriceMinor: -1 }], Array.from({ length: 31 }, (_, i) => ({ productId: `p${i}`, variantId: null, qty: 1 }))])(
    "rechaza %j",
    (raw) => {
      expect(parseCartLinesInput(raw)).toBeNull();
    },
  );
});
