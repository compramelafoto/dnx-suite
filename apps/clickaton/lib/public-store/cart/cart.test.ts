import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  STORE_CART_MAX_QUANTITY_PER_LINE,
  STORE_CART_SCHEMA_VERSION,
  STORE_CART_STORAGE_KEY,
  clampStoreCartQuantity,
  computeStoreCartTotals,
  initialStoreCartUiState,
  lineSubtotalMinor,
  parsePersistedStoreCart,
  parseStoreCartValidationRequest,
  storeCartLineKey,
  storeCartReducer,
  sumStoreCartUnits,
} from "@/lib/public-store/cart";
import type { StoreCartValidatedLine } from "@/lib/public-store/cart/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("store cart line identity", () => {
  it("separa variantes y mergea la misma combinación", () => {
    assert.equal(storeCartLineKey("p1", "v-m"), "p1::v-m");
    assert.notEqual(storeCartLineKey("p1", "v-m"), storeCartLineKey("p1", "v-xl"));
    let state = storeCartReducer(initialStoreCartUiState, {
      type: "HYDRATE",
      items: [],
      storageAvailable: true,
      recovered: false,
    });
    state = storeCartReducer(state, {
      type: "ADD_ITEM",
      productId: "prodAAAA1",
      variantId: "varBBBBB1",
      quantity: 1,
      availableStock: 10,
    });
    state = storeCartReducer(state, {
      type: "ADD_ITEM",
      productId: "prodAAAA1",
      variantId: "varBBBBB1",
      quantity: 2,
      availableStock: 10,
    });
    state = storeCartReducer(state, {
      type: "ADD_ITEM",
      productId: "prodAAAA1",
      variantId: "varCCCCC2",
      quantity: 1,
      availableStock: 10,
    });
    assert.equal(state.items.length, 2);
    assert.equal(sumStoreCartUnits(state.items), 4);
  });
});

describe("store cart quantities", () => {
  it("rechaza 0, negativos y decimales", () => {
    assert.equal(clampStoreCartQuantity({ quantity: 0 }).ok, false);
    assert.equal(clampStoreCartQuantity({ quantity: -1 }).ok, false);
    assert.equal(clampStoreCartQuantity({ quantity: 1.5 }).ok, false);
  });

  it("respeta máximo por línea y stock", () => {
    const aboveMax = clampStoreCartQuantity({
      quantity: STORE_CART_MAX_QUANTITY_PER_LINE + 5,
    });
    assert.equal(aboveMax.ok, false);
    assert.equal(aboveMax.quantity, STORE_CART_MAX_QUANTITY_PER_LINE);

    const aboveStock = clampStoreCartQuantity({ quantity: 8, availableStock: 3 });
    assert.equal(aboveStock.ok, false);
    assert.equal(aboveStock.quantity, 3);
  });
});

describe("store cart reducer", () => {
  it("elimina, vacía y actualiza cantidad", () => {
    let state = storeCartReducer(initialStoreCartUiState, {
      type: "HYDRATE",
      items: [],
      storageAvailable: true,
      recovered: false,
    });
    state = storeCartReducer(state, {
      type: "ADD_ITEM",
      productId: "prodAAAA1",
      variantId: "varBBBBB1",
      quantity: 2,
      availableStock: 10,
    });
    const key = state.items[0]!.lineKey;
    state = storeCartReducer(state, {
      type: "UPDATE_QUANTITY",
      lineKey: key,
      quantity: 5,
      availableStock: 10,
    });
    assert.equal(state.items[0]!.quantity, 5);
    state = storeCartReducer(state, { type: "REMOVE_ITEM", lineKey: key });
    assert.equal(state.items.length, 0);

    state = storeCartReducer(state, {
      type: "ADD_ITEM",
      productId: "prodAAAA1",
      variantId: "varBBBBB1",
      quantity: 1,
      availableStock: 10,
    });
    state = storeCartReducer(state, { type: "CLEAR" });
    assert.equal(state.items.length, 0);
  });

  it("no agrega sin hidratar", () => {
    const state = storeCartReducer(initialStoreCartUiState, {
      type: "ADD_ITEM",
      productId: "prodAAAA1",
      variantId: "varBBBBB1",
      quantity: 1,
    });
    assert.equal(state.items.length, 0);
  });
});

describe("store cart persistence schema", () => {
  it("usa clave versionada y recupera corrupción", () => {
    assert.equal(STORE_CART_STORAGE_KEY, "dnx-store-cart:v1:clickaton");
    assert.equal(STORE_CART_SCHEMA_VERSION, 1);
    const { state, recovered } = parsePersistedStoreCart({
      version: 99,
      platform: "clickaton",
      items: [{ productId: "x" }],
    });
    assert.equal(recovered, true);
    assert.equal(state.items.length, 0);
  });

  it("rechaza payload de validación abusivo", () => {
    const tooMany = {
      items: Array.from({ length: 50 }, (_, i) => ({
        productId: `prodAAAA${i}`.padEnd(10, "0").slice(0, 10),
        variantId: `varBBBBB${i}`.padEnd(10, "0").slice(0, 10),
        quantity: 1,
      })),
    };
    const parsed = parseStoreCartValidationRequest(tooMany);
    assert.equal(parsed.ok, false);
  });
});

describe("store cart totals", () => {
  it("excluye líneas inválidas del subtotal", () => {
    const lines: StoreCartValidatedLine[] = [
      {
        lineKey: "a",
        productId: "p1",
        variantId: "v1",
        quantity: 2,
        requestedQuantity: 2,
        status: "valid",
        contributesToSubtotal: true,
        unitPriceMinor: 1000,
        currency: "ARS",
        lineSubtotalMinor: lineSubtotalMinor(1000, 2),
        availableStock: 5,
        maxQuantity: 5,
        product: {
          productId: "p1",
          slug: "a",
          name: "A",
          imageUrl: null,
          imageAlt: "A",
          badge: "Oficial",
        },
        variant: { variantId: "v1", name: "M", code: "M" },
        messages: [],
      },
      {
        lineKey: "b",
        productId: "p2",
        variantId: "v2",
        quantity: 1,
        requestedQuantity: 1,
        status: "outOfStock",
        contributesToSubtotal: false,
        unitPriceMinor: 5000,
        currency: "ARS",
        lineSubtotalMinor: 0,
        availableStock: 0,
        maxQuantity: 0,
        product: {
          productId: "p2",
          slug: "b",
          name: "B",
          imageUrl: null,
          imageAlt: "B",
          badge: "Oficial",
        },
        variant: { variantId: "v2", name: "L", code: "L" },
        messages: ["Sin stock"],
      },
    ];
    const totals = computeStoreCartTotals(lines);
    assert.equal(totals.subtotalMinor, 2000);
    assert.equal(totals.validUnitCount, 2);
    assert.equal(totals.issueCount, 1);
  });
});

describe("store cart commercial guards", () => {
  it("no crea holds ni checkout en capas del carrito", () => {
    const files = [
      "lib/public-store/validate-store-cart.ts",
      "lib/public-store/cart/reducer.ts",
      "components/store/cart/StoreAddToCartPanel.tsx",
      "components/store/cart/StoreCartSummary.tsx",
      "app/api/store/cart/validate/route.ts",
    ];
    for (const file of files) {
      const src = readFileSync(path.join(root, file), "utf8");
      assert.doesNotMatch(src, /recordInventoryMovement/);
      assert.doesNotMatch(src, /ClickatonStockHold/);
      assert.doesNotMatch(src, /STORE_HOLD/);
      assert.doesNotMatch(src, /createOrder/i);
      assert.doesNotMatch(src, /mercado.?pago/i);
      assert.doesNotMatch(src, /dnxPayments/i);
    }
    const summary = readFileSync(
      path.join(root, "components/store/cart/StoreCartSummary.tsx"),
      "utf8",
    );
    assert.match(summary, /disabled/);
    assert.match(summary, /store-checkout-disabled/);
  });

  it("carrito page fuerza noindex", () => {
    const src = readFileSync(
      path.join(root, "app/(public)/tienda/carrito/page.tsx"),
      "utf8",
    );
    assert.match(src, /noIndex:\s*true/);
    assert.match(src, /index:\s*false/);
  });
});
