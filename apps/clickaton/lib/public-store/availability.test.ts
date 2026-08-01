import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STORE_LOW_STOCK_THRESHOLD,
  availabilityFromStock,
  productAvailabilityFromVariants,
  publicAvailableStock,
} from "@/lib/public-store/availability";

describe("public-store availability", () => {
  it("deriva stock público floor 0", () => {
    assert.equal(publicAvailableStock(10, 3), 7);
    assert.equal(publicAvailableStock(2, 5), 0);
  });

  it("mapea umbrales de presentación documentados", () => {
    assert.equal(availabilityFromStock(0).kind, "sold_out");
    assert.equal(availabilityFromStock(1).kind, "low_stock");
    assert.equal(availabilityFromStock(STORE_LOW_STOCK_THRESHOLD).kind, "low_stock");
    assert.equal(availabilityFromStock(STORE_LOW_STOCK_THRESHOLD + 1).kind, "available");
  });

  it("OUT_OF_STOCK fuerza agotado a nivel producto", () => {
    const view = productAvailabilityFromVariants({
      storeStatus: "OUT_OF_STOCK",
      variantAvailableStocks: [99, 12],
    });
    assert.equal(view.kind, "sold_out");
  });

  it("usa el máximo de variantes para estado global", () => {
    const view = productAvailabilityFromVariants({
      storeStatus: "ACTIVE",
      variantAvailableStocks: [0, 3, 0],
    });
    assert.equal(view.kind, "low_stock");
  });
});
