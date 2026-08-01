import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeStoreProductsBySlug,
  isStorefrontVisibleStatus,
  toStoreShortDescription,
} from "@/lib/public-store/visibility";

describe("public-store visibility", () => {
  it("acepta solo estados visibles de tienda", () => {
    assert.equal(isStorefrontVisibleStatus("ACTIVE"), true);
    assert.equal(isStorefrontVisibleStatus("OUT_OF_STOCK"), true);
    assert.equal(isStorefrontVisibleStatus("HIDDEN"), false);
    assert.equal(isStorefrontVisibleStatus("DRAFT"), false);
    assert.equal(isStorefrontVisibleStatus("ARCHIVED"), false);
    assert.equal(isStorefrontVisibleStatus(null), false);
  });

  it("truncá descripción corta", () => {
    assert.equal(toStoreShortDescription(null, null), null);
    assert.equal(toStoreShortDescription("  Hola  ", null), "Hola");
    const long = "x".repeat(200);
    const short = toStoreShortDescription(long, null, 140);
    assert.ok(short);
    assert.ok(short!.endsWith("…"));
    assert.ok(short!.length <= 140);
  });

  it("deduplica storeSlug preferiendo menor sortOrder", () => {
    const result = dedupeStoreProductsBySlug([
      { storeSlug: "remera-clickaton", storeSortOrder: 20, name: "B" },
      { storeSlug: "remera-clickaton", storeSortOrder: 10, name: "A" },
      { storeSlug: "otro", storeSortOrder: 5, name: "C" },
    ]);
    assert.equal(result.length, 2);
    assert.equal(
      result.find((r) => r.storeSlug === "remera-clickaton")?.name,
      "A",
    );
  });
});
