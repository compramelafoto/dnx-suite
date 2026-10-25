import { describe, expect, it } from "vitest";
import { checkoutLinesSignature, checkoutKeyStorageKey, resolveCheckoutKey } from "./checkout-key";

const gen = () => "clave-nueva-0000000001";

describe("checkoutLinesSignature", () => {
  it("no depende del orden de las líneas, sí de cantidades y talles", () => {
    const a = [
      { productId: "p1", variantId: null, qty: 1 },
      { productId: "p2", variantId: "v1", qty: 2 },
    ];
    expect(checkoutLinesSignature(a)).toBe(checkoutLinesSignature([a[1], a[0]]));
    expect(checkoutLinesSignature(a)).not.toBe(checkoutLinesSignature([a[0], { ...a[1], qty: 3 }]));
    expect(checkoutLinesSignature(a)).not.toBe(checkoutLinesSignature([a[0], { ...a[1], variantId: "v2" }]));
  });
});

describe("checkoutLinesSignature con obras", () => {
  it("la obra cuenta con su formato y cantidad; no se confunde con un producto", () => {
    const p = { productId: "p1", variantId: null, qty: 1 };
    const o = { kind: "artwork" as const, artworkListingId: "al1", printFormatId: "f1", qty: 1 };
    expect(checkoutLinesSignature([p, o])).toBe(checkoutLinesSignature([o, p]));
    expect(checkoutLinesSignature([p, o])).not.toBe(checkoutLinesSignature([p]));
    expect(checkoutLinesSignature([o])).not.toBe(checkoutLinesSignature([{ ...o, printFormatId: "f2" }]));
    expect(checkoutLinesSignature([o])).not.toBe(checkoutLinesSignature([{ ...o, qty: 2 }]));
    // Los carritos de productos conservan la firma de siempre (no se renuevan las claves guardadas).
    expect(checkoutLinesSignature([p])).toBe("p1:-=1");
  });
});

describe("resolveCheckoutKey", () => {
  it("el mismo carrito conserva su clave (un reintento es el mismo pedido)", () => {
    const guardada = { key: "clave-vieja-000000000001", sig: "s1" };
    expect(resolveCheckoutKey(guardada, "s1", gen)).toEqual(guardada);
  });

  it("si el carrito cambió, clave nueva", () => {
    expect(resolveCheckoutKey({ key: "clave-vieja-000000000001", sig: "s1" }, "s2", gen)).toEqual({
      key: "clave-nueva-0000000001",
      sig: "s2",
    });
  });

  it("lo guardado roto o ausente se reemplaza", () => {
    expect(resolveCheckoutKey(null, "s1", gen).key).toBe("clave-nueva-0000000001");
    expect(resolveCheckoutKey({ key: 3, sig: "s1" }, "s1", gen).key).toBe("clave-nueva-0000000001");
    expect(resolveCheckoutKey({ key: "corta", sig: "s1" }, "s1", gen).key).toBe("clave-nueva-0000000001");
  });
});

describe("checkoutKeyStorageKey", () => {
  it("una por institución, junto al carrito", () => {
    expect(checkoutKeyStorageKey("sfpr")).toBe("fotoffice-store-cart:v1:sfpr:checkout-key");
  });
});
