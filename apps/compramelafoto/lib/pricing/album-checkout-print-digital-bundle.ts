import { computePrintDigitalAddon } from "@/lib/pricing/album-sales-calculator";

/** Ítem de carrito/checkout de álbum (cliente o API). */
export type AlbumCheckoutCartItem = {
  fileKey?: string;
  originalName?: string | null;
  size?: string | null;
  finish?: string | null;
  acabado?: string | null;
  quantity?: number;
  tipo?: string;
  productId?: number | null;
  productName?: string | null;
  includedWithPrint?: boolean;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
  previewUrl?: string;
};

/**
 * Inserta una línea digital `includedWithPrint` antes de cada ítem impreso cuando el álbum
 * ofrece archivo digital junto a la impresión. El motor de precios (`pricing-engine`) usa
 * esa marca para cobrar el digital con el descuento configurado.
 */
export function expandAlbumCheckoutItemsWithPrintDigitalBundle<
  T extends AlbumCheckoutCartItem,
>(
  items: T[],
  album: { includeDigitalWithPrint?: boolean | null } | null | undefined
): T[] {
  if (!album?.includeDigitalWithPrint || !items.length) return items;
  if (items.some((it) => it.includedWithPrint)) return items;

  const expanded: T[] = [];
  for (const item of items) {
    const tipo = item.tipo || "digital";
    if (tipo === "impresa") {
      expanded.push({
        ...item,
        size: "DIGITAL",
        finish: "DIGITAL",
        acabado: "DIGITAL",
        quantity: 1,
        tipo: "digital",
        includedWithPrint: true,
      } as T);
    }
    expanded.push(item);
  }
  return expanded;
}

/** Precio cliente del digital que acompaña una impresión (base + fee − descuento bundle). */
export function computeAlbumPrintDigitalBundleAddon(params: {
  album: {
    includeDigitalWithPrint?: boolean | null;
    digitalPhotoPriceCents?: number | null;
    digitalWithPrintDiscountPercent?: number | null;
  } | null
  | undefined;
  digitalBaseCents: number;
  platformFeePct: number;
  printQuantity?: number;
}) {
  if (!params.album?.includeDigitalWithPrint) return null;
  const base =
    params.digitalBaseCents > 0
      ? params.digitalBaseCents
      : Number(params.album.digitalPhotoPriceCents ?? 0);
  return computePrintDigitalAddon({
    includeDigitalWithPrint: true,
    digitalPriceInput: String(base || 0),
    digitalWithPrintDiscountInput: String(params.album.digitalWithPrintDiscountPercent ?? 0),
    copyMode: "SAME_PHOTO",
    quantity: Math.max(1, params.printQuantity ?? 1),
    platformFeePct: params.platformFeePct,
  });
}
