/**
 * Arma los ítems del checkout (`POST /api/a/[id]/quote` y `/orders`) a partir de lo que la
 * familia eligió en la página de canje.
 *
 * Las fotos del combo van primero: `applyPrepaidPrintCredit` cubre las impresas en el
 * orden en que llegan, así que poner una extra adelante le regalaría la extra y le
 * cobraría una del combo.
 */

import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import type { ComboPrintProduct } from "./combo-print-product";

export type CanjeExtraFormat = "impresa" | "digital";

export type CanjeSelection = {
  comboPhotoIds: number[];
  extras: Array<{ photoId: number; format: CanjeExtraFormat }>;
};

export type CanjeCheckoutItem = {
  fileKey: string;
  tipo: "impresa" | "digital";
  size: string;
  acabado?: string;
  finish?: string;
  quantity: number;
  productId?: number;
  productName?: string;
  includedWithPrint?: boolean;
};

function impresa(
  photoId: number,
  product: ComboPrintProduct,
  includeDigitalWithPrint: boolean
): CanjeCheckoutItem[] {
  const fileKey = albumPhotoFileKey(photoId);
  const finish = (product.finish ?? "BRILLO").toUpperCase();
  const out: CanjeCheckoutItem[] = [];
  // Mismo orden que arma la galería (`expandAlbumCheckoutItemsWithPrintDigitalBundle`):
  // el digital incluido antes de su impresa.
  if (includeDigitalWithPrint) {
    out.push({ fileKey, tipo: "digital", size: "DIGITAL", quantity: 1, includedWithPrint: true });
  }
  out.push({
    fileKey,
    tipo: "impresa",
    size: product.size,
    acabado: finish,
    finish,
    quantity: 1,
    productId: product.productId,
    productName: product.name,
  });
  return out;
}

export function buildCanjeOrderItems(
  selection: CanjeSelection,
  product: ComboPrintProduct,
  includeDigitalWithPrint: boolean
): CanjeCheckoutItem[] {
  const items: CanjeCheckoutItem[] = [];
  for (const id of selection.comboPhotoIds) {
    items.push(...impresa(id, product, includeDigitalWithPrint));
  }
  for (const extra of selection.extras) {
    if (extra.format === "impresa") {
      items.push(...impresa(extra.photoId, product, includeDigitalWithPrint));
    } else {
      items.push({
        fileKey: albumPhotoFileKey(extra.photoId),
        tipo: "digital",
        size: "DIGITAL",
        quantity: 1,
      });
    }
  }
  return items;
}
