import { describe, expect, it } from "vitest";
import { buildStoreProductJsonLd, serializeJsonLd } from "./product-json-ld";
import type { StoreProductDetail } from "./storefront";

const detalle = (o: Partial<StoreProductDetail> = {}): StoreProductDetail => ({
  productId: "p1",
  slug: "remera",
  title: "Remera",
  description: "De algodón",
  categoryName: null,
  images: [{ url: "https://img/1.jpg", alt: null }],
  sizeChartImageUrl: null,
  maxPerOrder: null,
  priceMinor: 1500050,
  available: 3,
  variants: [],
  soldOut: false,
  ...o,
});

describe("buildStoreProductJsonLd", () => {
  it("sin talles: Offer con precio, moneda y disponibilidad", () => {
    expect(buildStoreProductJsonLd(detalle(), { brandName: "SFPR", url: "https://x/w/sfpr/tienda/remera" })).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Remera",
      description: "De algodón",
      image: ["https://img/1.jpg"],
      brand: { "@type": "Brand", name: "SFPR" },
      offers: {
        "@type": "Offer",
        price: "15000.50",
        priceCurrency: "ARS",
        availability: "https://schema.org/InStock",
        url: "https://x/w/sfpr/tienda/remera",
      },
    });
  });

  it("agotado y sin descripción ni imágenes", () => {
    const j = buildStoreProductJsonLd(detalle({ description: null, images: [], soldOut: true }), { brandName: "SFPR" });
    expect(j.description).toBeUndefined();
    expect(j.image).toBeUndefined();
    expect(j.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
    expect(j.offers).not.toHaveProperty("url");
  });

  it("con talles: AggregateOffer con el rango de precios", () => {
    const j = buildStoreProductJsonLd(
      detalle({
        variants: [
          { id: "a", name: "S", priceMinor: 1000, available: 0 },
          { id: "b", name: "M", priceMinor: 3000, available: null },
        ],
      }),
      { brandName: "SFPR" },
    );
    expect(j.offers).toEqual({
      "@type": "AggregateOffer",
      lowPrice: "10.00",
      highPrice: "30.00",
      priceCurrency: "ARS",
      offerCount: 2,
      availability: "https://schema.org/InStock",
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapa '<' para que un texto no pueda cerrar el <script>", () => {
    expect(serializeJsonLd({ name: "</script><b>" })).toBe('{"name":"\\u003c/script>\\u003cb>"}');
  });
});
