/**
 * Una línea del carrito. Dos clases:
 * - `product`: un producto del catálogo de Ventas (con su talle, si tiene).
 * - `artwork`: la copia impresa de una obra de concurso en un formato (`PrintFormat`).
 *
 * Los carritos guardados antes de las obras no tienen `kind`: se leen como `product`
 * (`parseCartState`). Precio, nombre e imagen son sólo para mostrar: el servidor los revalida.
 */
export type ProductCartLine = {
  kind: "product";
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  unitPriceMinor: number;
  qty: number;
};

export type ArtworkCartLine = {
  kind: "artwork";
  /** `ArtworkListing.id` (de FOTOFFICE): nunca ids de FotoRank en el navegador. */
  artworkListingId: string;
  printFormatId: string;
  slug: string;
  title: string;
  formatName: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  qty: number;
};

export type CartLine = ProductCartLine | ArtworkCartLine;

export type CartState = { version: 1; lines: CartLine[] };

export type CartAction =
  | { type: "add"; line: CartLine }
  | { type: "setQty"; key: string; qty: number }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "replaceLines"; lines: CartLine[] };
