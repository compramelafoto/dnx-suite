/**
 * Resuelve un bloque de galería parseado (RawGallery) contra photoById
 * (view models públicos ya resueltos por getPublicEditorialCoverageByArticleSlug)
 * para producir lo que el slideshow necesita: nunca originales, nunca
 * storage keys, nunca URLs firmadas — mismo contrato que PublicEditorialPhoto.
 */

import { isSafeUrl, EDITORIAL_GALLERY_MIN_IMAGES } from "@repo/editor";
import type { PublicEditorialPhotoViewModel } from "@/lib/public-coverage";
import type { RawGalleryAttrs, RawGalleryImage } from "./parse-gallery-figure";

export type ResolvedGalleryImage = {
  id: string;
  alt: string;
  caption: string | null;
  credit: string | null;
  photographerName: string | null;
  photographerProfileUrl: string | null;
  purchaseHref: string | null;
  /** null => imagen no disponible (revocada / removida / URL insegura). */
  src: string | null;
  width?: number;
  height?: number;
};

export type ResolvedGallery = {
  id: string;
  title: string | null;
  caption: string | null;
  autoplay: boolean;
  intervalMs: number;
  loop: boolean;
  images: ResolvedGalleryImage[];
};

const MIN_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 20000;

function resolveOneImage(
  raw: RawGalleryImage,
  photoById: Record<string, PublicEditorialPhotoViewModel> | undefined,
): ResolvedGalleryImage {
  if (raw.source === "CLF") {
    const photo = raw.photoId ? photoById?.[raw.photoId] : undefined;
    if (photo && !photo.revoked && !photo.unavailable && photo.src) {
      return {
        id: raw.id,
        alt: raw.alt || photo.altText,
        caption: raw.caption,
        credit: raw.credit || photo.credit,
        photographerName: raw.photographerName || photo.photographerName,
        photographerProfileUrl: isSafeUrl(raw.photographerProfileUrl)
          ? raw.photographerProfileUrl
          : null,
        purchaseHref: photo.canShowPurchaseCta && isSafeUrl(photo.purchaseHref)
          ? photo.purchaseHref
          : isSafeUrl(raw.purchaseUrl)
            ? raw.purchaseUrl
            : null,
        src: photo.src,
        width: raw.width,
        height: raw.height,
      };
    }
    // Foto CLF revocada / removida / no resuelta en photoById: sin original disponible.
    return {
      id: raw.id,
      alt: raw.alt,
      caption: raw.caption,
      credit: raw.credit,
      photographerName: raw.photographerName,
      photographerProfileUrl: null,
      purchaseHref: null,
      src: null,
      width: raw.width,
      height: raw.height,
    };
  }

  // INFOSPOT: derivado propio, URL estable persistida en el bloque.
  return {
    id: raw.id,
    alt: raw.alt,
    caption: raw.caption,
    credit: raw.credit,
    photographerName: raw.photographerName,
    photographerProfileUrl: isSafeUrl(raw.photographerProfileUrl)
      ? raw.photographerProfileUrl
      : null,
    purchaseHref: isSafeUrl(raw.purchaseUrl) ? raw.purchaseUrl : null,
    src: raw.previewUrl && isSafeUrl(raw.previewUrl) ? raw.previewUrl : null,
    width: raw.width,
    height: raw.height,
  };
}

/**
 * Devuelve null cuando el bloque no es mostrable de forma segura (menos de
 * 2 imágenes reconocidas, o casi todas rotas/revocadas) — degrada a "no
 * renderizar nada" en vez de mostrar un slideshow roto o a medio armar.
 */
export function resolveGalleryForRender(
  attrs: RawGalleryAttrs,
  rawImages: RawGalleryImage[],
  photoById: Record<string, PublicEditorialPhotoViewModel> | undefined,
): ResolvedGallery | null {
  if (rawImages.length < EDITORIAL_GALLERY_MIN_IMAGES) return null;

  const images = rawImages.map((img) => resolveOneImage(img, photoById));
  const available = images.filter((img) => img.src);
  if (available.length < EDITORIAL_GALLERY_MIN_IMAGES) return null;

  const intervalMs = Math.min(
    MAX_INTERVAL_MS,
    Math.max(MIN_INTERVAL_MS, attrs.intervalMs || 5000),
  );

  return {
    id: attrs.id,
    title: attrs.title,
    caption: attrs.caption,
    autoplay: attrs.autoplay,
    intervalMs,
    loop: attrs.loop,
    images,
  };
}
