import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildStoreProductJsonLd } from "@/lib/public-store/product-json-ld";
import type { PublicStoreProductDetail } from "@/lib/public-store/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("store purchase / cart guards", () => {
  it("add-to-cart no usa localStorage ni server actions de compra", () => {
    const src = readSrc("components/store/cart/StoreAddToCartPanel.tsx");
    assert.match(src, /Agregar al carrito/);
    assert.doesNotMatch(src, /\blocalStorage\b/);
    assert.doesNotMatch(src, /"use server"/);
    assert.doesNotMatch(src, /\bfetch\s*\(/);
  });

  it("checkout CTA queda gated por flag (disabled por defecto)", () => {
    const src = readSrc("components/store/cart/StoreCartSummary.tsx");
    assert.match(src, /data-testid="store-checkout-disabled"/);
    assert.match(src, /disabled/);
    assert.match(src, /checkoutEnabled/);
  });

  it("la ficha no escribe inventario", () => {
    const files = [
      "components/store/StoreProductDetailView.tsx",
      "components/store/StoreProductOptionsPanel.tsx",
      "lib/public-store/map-store-product.ts",
      "lib/public-store/validate-store-cart.ts",
    ];
    for (const file of files) {
      const src = readSrc(file);
      assert.doesNotMatch(src, /clickatonStockHold/i);
      assert.doesNotMatch(src, /ClickatonInventoryMovement/);
      assert.doesNotMatch(src, /recordInventoryMovement/);
    }
  });

  it("JSON-LD Product no inventa Offer ni reviews", () => {
    const product: PublicStoreProductDetail = {
      id: "p1",
      slug: "remera",
      name: "Remera",
      shortDescription: "Oficial",
      description: "Descripción",
      price: 100,
      currency: "ARS",
      priceLabel: "$ 1 ARS",
      status: "ACTIVE",
      badge: "Oficial Clickatón",
      editionId: "e1",
      images: [
        {
          id: "i1",
          url: "https://cdn/x.jpg",
          alt: "Remera",
          mediaType: "PRIMARY",
          sortOrder: 0,
        },
      ],
      primaryImage: {
        id: "i1",
        url: "https://cdn/x.jpg",
        alt: "Remera",
        mediaType: "PRIMARY",
        sortOrder: 0,
      },
      variants: [],
      availability: { kind: "available", label: "Disponible", availableStock: 10 },
      initialSelectedVariantId: null,
    };
    const jsonLd = buildStoreProductJsonLd(product);
    assert.equal(jsonLd["@type"], "Product");
    assert.equal("offers" in jsonLd, false);
  });
});
