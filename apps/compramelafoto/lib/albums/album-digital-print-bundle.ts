/** Digital incluido al comprar impresión: no requiere venta digital suelta activa. */
export function albumIncludesDigitalWithPrint(
  album: {
    includeDigitalWithPrint?: boolean | null;
    digitalPhotoPriceCents?: number | null;
  } | null
  | undefined
): boolean {
  if (!album?.includeDigitalWithPrint) return false;
  const price = album.digitalPhotoPriceCents;
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

export {
  expandAlbumCheckoutItemsWithPrintDigitalBundle,
  type AlbumCheckoutCartItem,
} from "@/lib/pricing/album-checkout-print-digital-bundle";
