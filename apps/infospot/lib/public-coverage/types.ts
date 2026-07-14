/**
 * View models públicos seguros (sin storage keys ni originales CLF).
 */

export type PublicEditorialPhotoViewModel = {
  id: string;
  usageType: "COVER" | "INLINE" | "GALLERY" | "FEATURED";
  sortOrder: number;
  caption: string | null;
  altText: string;
  displaySize: string;
  photographerName: string;
  credit: string;
  /** null si REVOKED / no mostrable */
  src: string | null;
  srcSet: string | null;
  sizes: string;
  widthHint: number | null;
  revoked: boolean;
  unavailable: boolean;
  canShowPurchaseCta: boolean;
  /** CTA específico de foto (deep link), si existe. */
  purchaseHref: string | null;
  albumHref: string | null;
  /** true si hay URL de compra específica (no solo álbum). */
  hasSpecificPurchaseUrl: boolean;
  photographerProfileHref: string | null;
  /** Encuadre portada 0–1 (object-position). */
  focalX: number | null;
  focalY: number | null;
};

export type PublicCoveragePhotographer = {
  clfUserId: number;
  displayName: string;
  role: string;
  photoCount: number;
  albumHref: string | null;
  profileHref: string | null;
};

export type PublicCoverageAlbum = {
  clfAlbumId: number;
  title: string;
  publicUrl: string | null;
  commercialStatus: string;
  canShowPurchaseCta: boolean;
  photographerName: string | null;
  photoCount: number | null;
  trackedAlbumHref: string | null;
  trackedPurchaseHref: string | null;
};

export type PublicRelatedArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
};

export type PublicRelatedEvent = {
  id: string;
  title: string;
  slug: string;
  city: string;
  province: string;
  startAt: Date;
  coverImageUrl: string | null;
  temporalLabel: string;
};

export type PublicEditorialCoverage = {
  articleId: string;
  articleSlug: string;
  event: {
    id: string;
    title: string;
    slug: string;
    city: string;
    province: string;
    startAt: Date;
    temporalLabel: string;
    registrationUrl: string | null;
    seekingPhotographers: boolean;
    joinHref: string | null;
  } | null;
  coverage: {
    id: string;
    title: string;
    clfAlbumId: number;
    commercialStatus: string;
    canShowPurchaseCta: boolean;
  } | null;
  coverPhoto: PublicEditorialPhotoViewModel | null;
  inlinePhotos: PublicEditorialPhotoViewModel[];
  galleryPhotos: PublicEditorialPhotoViewModel[];
  featuredPhotos: PublicEditorialPhotoViewModel[];
  photoById: Record<string, PublicEditorialPhotoViewModel>;
  photographers: PublicCoveragePhotographer[];
  albums: PublicCoverageAlbum[];
  commercialAvailability: {
    status: string;
    canShowPurchaseCta: boolean;
    albumUrl: string | null;
  };
  relatedArticles: PublicRelatedArticle[];
  relatedEvents: PublicRelatedEvent[];
  ogImageUrl: string | null;
};
