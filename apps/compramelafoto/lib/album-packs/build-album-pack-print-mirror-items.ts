import type { AlbumOrderPrintMirrorItemInput } from "@/lib/orders/create-album-order-print-order-mirror";
import type { AlbumPackOrderItemCreateInput } from "@/lib/album-packs/prepare-album-pack-order-creation";
import { OrderItemType } from "@/lib/prisma";

export type AlbumPackPhotoForPrintMirror = {
  id: number;
  originalKey: string;
};

export function buildAlbumPackPrintMirrorItems(
  items: AlbumPackOrderItemCreateInput[],
  photosById: Map<number, AlbumPackPhotoForPrintMirror>
): AlbumOrderPrintMirrorItemInput[] {
  const mirrorItems: AlbumOrderPrintMirrorItemInput[] = [];

  for (const item of items) {
    if (item.productType !== OrderItemType.PRINT) continue;
    const photo = photosById.get(item.photoId);
    if (!photo?.originalKey) continue;

    const size = String(item.size ?? "").trim();
    if (!size) continue;

    const finishRaw = item.finish ?? "BRILLO";
    const acabado = String(finishRaw).trim().toUpperCase() || "BRILLO";
    const fileKey = photo.originalKey.trim();
    const originalName = fileKey.split("/").pop() || fileKey;

    mirrorItems.push({
      fileKey,
      originalName,
      size,
      acabado,
      quantity: item.quantity,
      unitPrice: item.priceCents,
      subtotal: item.subtotalCents,
    });
  }

  return mirrorItems;
}
