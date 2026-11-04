import { describe, expect, it } from "vitest";
import type { StorefrontProductRow } from "../storefront";
import { fulfillmentSnapshot } from "./snapshot";

function row(cambios: Partial<StorefrontProductRow> = {}): StorefrontProductRow {
  return {
    id: "p1",
    name: "Camera Flag",
    description: null,
    priceArs: "35000",
    tracksStock: false,
    stockQty: 0,
    imageUrl: null,
    category: null,
    variantCount: 2,
    sku: "DNX-CFLAG",
    listing: {
      slug: "camera-flag",
      onlineTitle: null,
      onlineDescription: null,
      sizeChartImageUrl: null,
      maxPerOrder: null,
      fulfillmentProveedorId: "prov1",
      printFileUrl: "https://drive.google.com/general",
    },
    images: [],
    variants: [
      { id: "v1", name: "Oversize negra / M", priceArs: null, stockQty: 0, sku: "DNX-CFLAG-OVN-M", printFileUrl: null },
      { id: "v2", name: "Clásica blanca / L", priceArs: null, stockQty: 0, sku: " ", printFileUrl: "https://drive.google.com/blanca" },
    ],
    ...cambios,
  };
}

describe("fulfillmentSnapshot", () => {
  it("toma el código y el archivo del talle, y si no tiene, los del producto y la ficha", () => {
    expect(fulfillmentSnapshot(row(), "v1")).toEqual({
      sku: "DNX-CFLAG-OVN-M",
      fulfillmentProveedorId: "prov1",
      printFileUrl: "https://drive.google.com/general",
    });
    expect(fulfillmentSnapshot(row(), "v2")).toEqual({
      sku: "DNX-CFLAG",
      fulfillmentProveedorId: "prov1",
      printFileUrl: "https://drive.google.com/blanca",
    });
  });
  it("sin talle ni productor", () => {
    const r = row({ listing: { ...row().listing, fulfillmentProveedorId: null, printFileUrl: null } });
    expect(fulfillmentSnapshot(r, null)).toEqual({ sku: "DNX-CFLAG", fulfillmentProveedorId: null, printFileUrl: null });
  });
  it("sin fila del catálogo, todo vacío", () => {
    expect(fulfillmentSnapshot(undefined, "v1")).toEqual({ sku: null, fulfillmentProveedorId: null, printFileUrl: null });
  });
});
