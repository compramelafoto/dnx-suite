import type { AlbumPackFulfillmentKind } from "@/lib/album-packs/album-pack-composition-types";

export function albumPackFulfillmentHasPrint(kind: AlbumPackFulfillmentKind): boolean {
  return kind === "PRINT" || kind === "MIXED";
}

/** photoIds que alimentan ZIP digital (solo líneas DIGITAL). */
export function collectAlbumPackDigitalPhotoIdsForZip(
  items: Array<{ productType: string; photoId: number }>
): number[] {
  return items
    .filter((item) => item.productType === "DIGITAL")
    .map((item) => item.photoId);
}
