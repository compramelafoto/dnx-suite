/**
 * Galería pública — independiente del evento estructural.
 * Sin fetch; sin integración ComprameLaFoto.
 */

import type { GalleryStatus } from "@/types/marathon";

export type GalleryImageCommercialAvailability =
  | "not_for_sale"
  | "available"
  | "sold_out"
  | "restricted";

/**
 * Imagen individual de galería pública.
 */
export type PublicGalleryImage = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  photographerCredit: string;
  /** Futuro enlace de compra (p. ej. ComprameLaFoto). */
  purchaseUrl?: string;
  categoryId?: string;
  challengeId?: string;
  alt: string;
  publicationConsent: boolean;
  commercialAvailability: GalleryImageCommercialAvailability;
};

/**
 * Contenedor de galería de una edición.
 */
export type PublicMarathonGallery = {
  marathonId: string;
  status: GalleryStatus;
  imageCount: number;
  selectionCount?: number;
  winnerCount?: number;
  /** URL canónica futura de la galería dedicada. */
  galleryUrl?: string;
  images: PublicGalleryImage[];
  publishedAt?: string;
  updatedAt: string;
};
