import { buildPhotoViewApiUrl } from "@/lib/images/public-photo-view-url";

/** Miniatura del carrito de compra: misma API que la galería (`mode=thumb` con marca). */
export function resolveCheckoutOrderPhotoThumbUrl(params: {
  photoId: number;
  albumId: number;
  storedPreviewUrl?: string | null;
}): string {
  return buildPhotoViewApiUrl(params.photoId, params.albumId, "thumb");
}
