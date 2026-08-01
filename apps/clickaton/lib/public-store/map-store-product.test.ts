import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPublicStoreProductDetail } from "@/lib/public-store/map-store-product";

const baseRow = {
  id: "prod-1",
  editionId: "ed-1",
  name: "Remera Clickatón",
  description: "Descripción catálogo larga ".repeat(10),
  storeSlug: "remera-clickaton",
  storeTitle: "Remera Oficial",
  storeDescription: "Corta de tienda",
  storePrice: 1_800_000,
  storeCurrency: "ARS",
  storeStatus: "ACTIVE",
  primaryImageAssetId: "asset-1",
  variants: [
    {
      id: "v-m",
      code: "M",
      name: "M",
      sku: "REM-M",
      stock: 10,
      reservedStock: 0,
      sortOrder: 30,
      isActive: true,
    },
    {
      id: "v-s",
      code: "S",
      name: "S",
      sku: "REM-S",
      stock: 0,
      reservedStock: 0,
      sortOrder: 20,
      isActive: true,
    },
  ],
  media: [
    {
      id: "m1",
      assetId: "asset-1",
      mediaType: "PRIMARY",
      sortOrder: 10,
      altText: "Frente",
      status: "ACTIVE",
    },
    {
      id: "m2",
      assetId: "asset-2",
      mediaType: "GALLERY",
      sortOrder: 20,
      altText: null,
      status: "ACTIVE",
    },
  ],
};

describe("mapPublicStoreProductDetail", () => {
  it("mapea producto ACTIVE público con precio storePrice exclusivo", () => {
    const urls = new Map([
      ["asset-1", "https://cdn.example/a1.jpg"],
      ["asset-2", "https://cdn.example/a2.jpg"],
    ]);
    const detail = mapPublicStoreProductDetail({
      row: baseRow,
      urlByAssetId: urls,
      priceLabel: "$ 18.000 ARS",
      badge: "Oficial Clickatón",
    });
    assert.ok(detail);
    assert.equal(detail!.price, 1_800_000);
    assert.equal(detail!.priceLabel, "$ 18.000 ARS");
    assert.equal(detail!.slug, "remera-clickaton");
    assert.equal(detail!.name, "Remera Oficial");
    assert.equal(detail!.images.length, 2);
    assert.equal(detail!.primaryImage?.url, "https://cdn.example/a1.jpg");
  });

  it("variantes sin stock quedan no seleccionables", () => {
    const detail = mapPublicStoreProductDetail({
      row: baseRow,
      urlByAssetId: new Map([["asset-1", "https://cdn.example/a1.jpg"]]),
      priceLabel: "$ 18.000 ARS",
      badge: "Oficial Clickatón",
    });
    const soldOut = detail!.variants.find((v) => v.id === "v-s");
    const ok = detail!.variants.find((v) => v.id === "v-m");
    assert.equal(soldOut?.selectable, false);
    assert.equal(soldOut?.availability.kind, "sold_out");
    assert.equal(ok?.selectable, true);
  });

  it("no auto-selecciona si hay más de una variante disponible", () => {
    const row = {
      ...baseRow,
      variants: [
        { ...baseRow.variants[0]!, id: "a", stock: 5 },
        { ...baseRow.variants[0]!, id: "b", code: "L", name: "L", stock: 5 },
      ],
    };
    const detail = mapPublicStoreProductDetail({
      row,
      urlByAssetId: new Map(),
      priceLabel: "$ 18.000 ARS",
      badge: "Oficial Clickatón",
    });
    assert.equal(detail!.initialSelectedVariantId, null);
  });

  it("auto-selecciona si hay exactamente una variante seleccionable", () => {
    const detail = mapPublicStoreProductDetail({
      row: baseRow,
      urlByAssetId: new Map(),
      priceLabel: "$ 18.000 ARS",
      badge: "Oficial Clickatón",
    });
    assert.equal(detail!.initialSelectedVariantId, "v-m");
  });

  it("OUT_OF_STOCK puede verse como agotado", () => {
    const detail = mapPublicStoreProductDetail({
      row: { ...baseRow, storeStatus: "OUT_OF_STOCK" },
      urlByAssetId: new Map(),
      priceLabel: "$ 18.000 ARS",
      badge: "Oficial Clickatón",
    });
    assert.ok(detail);
    assert.equal(detail!.status, "OUT_OF_STOCK");
    assert.equal(detail!.availability.kind, "sold_out");
  });

  it("rechaza DRAFT / sin precio / sin slug", () => {
    assert.equal(
      mapPublicStoreProductDetail({
        row: { ...baseRow, storeStatus: "DRAFT" },
        urlByAssetId: new Map(),
        priceLabel: "$ 18.000 ARS",
        badge: "Oficial Clickatón",
      }),
      null,
    );
    assert.equal(
      mapPublicStoreProductDetail({
        row: { ...baseRow, storePrice: -1 },
        urlByAssetId: new Map(),
        priceLabel: "$ 18.000 ARS",
        badge: "Oficial Clickatón",
      }),
      null,
    );
    assert.equal(
      mapPublicStoreProductDetail({
        row: { ...baseRow, storeSlug: "  " },
        urlByAssetId: new Map(),
        priceLabel: "$ 18.000 ARS",
        badge: "Oficial Clickatón",
      }),
      null,
    );
  });

  it("fallback sin imágenes no rompe", () => {
    const detail = mapPublicStoreProductDetail({
      row: { ...baseRow, primaryImageAssetId: null, media: [] },
      urlByAssetId: new Map(),
      priceLabel: "$ 18.000 ARS",
      badge: "Oficial Clickatón",
    });
    assert.ok(detail);
    assert.equal(detail!.images.length, 0);
    assert.equal(detail!.primaryImage, null);
  });
});
