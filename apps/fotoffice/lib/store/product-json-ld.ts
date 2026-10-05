import { minorToDecimalString } from "@/lib/membership/money";
import type { StoreProductDetail } from "./storefront";

/**
 * Datos estructurados (`schema.org/Product`) de la ficha de la tienda. Módulo PURO.
 *
 * Portado de Clickatón (`apps/clickaton/lib/public-store/product-json-ld.ts`). Allá se omitía la
 * oferta porque todavía no se podía comprar; acá la tienda sólo es pública abierta, así que el
 * precio y la disponibilidad son verdaderos y van. Sólo datos que la ficha muestra.
 */

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

type Offer =
  | { "@type": "Offer"; price: string; priceCurrency: "ARS"; availability: string; url?: string }
  | {
      "@type": "AggregateOffer";
      lowPrice: string;
      highPrice: string;
      priceCurrency: "ARS";
      offerCount: number;
      availability: string;
    };

export type StoreProductJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description?: string;
  image?: string[];
  brand: { "@type": "Brand"; name: string };
  offers: Offer;
};

export function buildStoreProductJsonLd(
  product: StoreProductDetail,
  opts: { brandName: string; url?: string },
): StoreProductJsonLd {
  const availability = product.soldOut ? OUT_OF_STOCK : IN_STOCK;
  let offers: Offer;
  if (product.variants.length > 0) {
    const precios = product.variants.map((v) => v.priceMinor);
    offers = {
      "@type": "AggregateOffer",
      lowPrice: minorToDecimalString(Math.min(...precios)),
      highPrice: minorToDecimalString(Math.max(...precios)),
      priceCurrency: "ARS",
      offerCount: product.variants.length,
      availability,
    };
  } else {
    offers = {
      "@type": "Offer",
      price: minorToDecimalString(product.priceMinor),
      priceCurrency: "ARS",
      availability,
      ...(opts.url ? { url: opts.url } : {}),
    };
  }

  const jsonLd: StoreProductJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    brand: { "@type": "Brand", name: opts.brandName },
    offers,
  };
  if (product.description) jsonLd.description = product.description;
  const images = product.images.map((i) => i.url).filter(Boolean);
  if (images.length > 0) jsonLd.image = images;
  return jsonLd;
}

/**
 * JSON listo para `<script type="application/ld+json">`. Los textos los escribe el negocio: un
 * `</script>` en la descripción cerraría la etiqueta, por eso `<` sale escapado.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
