/**
 * JSON-LD Product cauteloso: sin Offer mientras no haya checkout activo.
 * Solo datos verdaderos del DTO público.
 */

import type { PublicStoreProductDetail } from "@/lib/public-store/types";

export type StoreProductJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description?: string;
  image?: string[];
  brand: {
    "@type": "Brand";
    name: string;
  };
  sku?: string;
};

/**
 * Construye JSON-LD Product sin Offer (venta aún no habilitada).
 * Omitir Offer evita afirmar availability/price comercial prematuro.
 */
export function buildStoreProductJsonLd(
  product: PublicStoreProductDetail,
): StoreProductJsonLd {
  const images = product.images.map((i) => i.url).filter(Boolean);
  const selectableSku =
    product.variants.find((v) => v.selectable && v.sku)?.sku ??
    product.variants.find((v) => v.sku)?.sku ??
    undefined;

  const jsonLd: StoreProductJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: {
      "@type": "Brand",
      name: "Clickatón",
    },
  };

  const description = product.shortDescription ?? product.description;
  if (description) jsonLd.description = description;
  if (images.length > 0) jsonLd.image = images;
  if (selectableSku) jsonLd.sku = selectableSku;

  return jsonLd;
}
