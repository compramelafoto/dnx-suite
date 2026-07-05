import { isLegacyAlbumPrintSalesEnabled } from "@/lib/albums/album-sale-channels";
import {
  GALLERY_SALES_NOT_READY_MESSAGE,
  isAlbumSinglesPurchaseReady,
  type AlbumSalesReadinessInput,
} from "@/lib/albums/album-sales-readiness";
import { clientTotalFromPhotographerBaseArs } from "@/lib/pricing/client-price";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import {
  buildDigitalBulkDiscountBenefitsLabel,
  buildStructuredDigitalDiscounts,
  type DigitalBulkDiscountInput,
  type DigitalBulkDiscountTier,
} from "@/lib/pricing/digital-bulk-discount";
import {
  resolveEventDigitalPhotoBasePrice,
  type ResolverCollaborativeEvent,
} from "@/lib/pricing/event-digital-photo-price-resolver";

export type GalleryPricingUnavailableKind =
  | "UNAVAILABLE"
  | "MIXED_FORMATS"
  | "NO_DIGITAL"
  | "NO_PHOTOS"
  | "PRICE_UNRESOLVED"
  | "SALES_NOT_READY";

export type GalleryPricingSnapshot =
  | ({
      kind: "DIGITAL_UNIFORM";
      showBand: true;
      digitalUnitPriceArs: number;
      digitalUnitPriceLabel: string;
      discountLabel?: string | null;
      discounts?: DigitalBulkDiscountTier[];
      enablePrintedPhotos?: boolean;
      digitalDiscount5Plus?: number | null;
      digitalDiscount10Plus?: number | null;
      digitalDiscount20Plus?: number | null;
    } & DigitalBulkDiscountInput)
  | {
      kind: GalleryPricingUnavailableKind;
      showBand: false;
      reason: string;
    };

export type GalleryPricingPhotoInput = {
  id: number;
  userId?: number | null;
  sellDigital?: boolean | null;
  sellPrint?: boolean | null;
};

export type GalleryPricingAlbumInput = AlbumSalesReadinessInput & {
  userId: number;
  eventId?: number | null;
  enableDigitalPhotos?: boolean | null;
  enablePrintedPhotos?: boolean | null;
  digitalPhotoPriceCents?: number | null;
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
  includeDigitalWithPrint?: boolean | null;
  digitalWithPrintDiscountPercent?: number | null;
  checkoutDigitalFeePercent: number;
  platformMinDigitalPriceArs: number;
  ownerDefaultDigitalPriceArs?: number | null;
  event?: ResolverCollaborativeEvent | null;
  /** Precio base digital por uploader (pesos ARS), para álbumes colaborativos. */
  uploaderDefaultDigitalPriceArsByUserId?: Record<number, number | null | undefined>;
};

function positiveArs(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function hasMixedSellFormats(photos: GalleryPricingPhotoInput[]): boolean {
  if (photos.length === 0) return false;
  const sellDigitalValues = new Set(photos.map((p) => p.sellDigital !== false));
  const sellPrintValues = new Set(photos.map((p) => p.sellPrint !== false));
  return sellDigitalValues.size > 1 || sellPrintValues.size > 1;
}

function resolveLegacyDigitalBaseArs(params: {
  albumOwnerId: number;
  uploaderId: number;
  albumDigitalPriceCents: number | null | undefined;
  ownerDefaultDigitalPriceArs: number | null | undefined;
  uploaderDefaultDigitalPriceArs: number | null | undefined;
  platformMinDigitalPriceArs: number;
}): number {
  const albumHasPrice = positiveArs(params.albumDigitalPriceCents) != null;
  const platformMin = positiveArs(params.platformMinDigitalPriceArs) ?? 0;

  if (params.uploaderId === params.albumOwnerId && albumHasPrice) {
    return positiveArs(params.albumDigitalPriceCents) ?? platformMin;
  }

  const fromUploader = positiveArs(params.uploaderDefaultDigitalPriceArs);
  if (fromUploader != null) return fromUploader;

  const fromOwnerDefault = positiveArs(params.ownerDefaultDigitalPriceArs);
  if (fromOwnerDefault != null) return fromOwnerDefault;

  return platformMin > 0 ? platformMin : 0;
}

function resolvePhotoDigitalBaseArs(
  photo: GalleryPricingPhotoInput,
  album: GalleryPricingAlbumInput
): number {
  const albumOwnerId = album.userId;
  const uploaderId = photo.userId ?? albumOwnerId;
  const uploaderDefault =
    album.uploaderDefaultDigitalPriceArsByUserId?.[uploaderId] ?? null;

  let legacyBase = resolveLegacyDigitalBaseArs({
    albumOwnerId,
    uploaderId,
    albumDigitalPriceCents: album.digitalPhotoPriceCents,
    ownerDefaultDigitalPriceArs: album.ownerDefaultDigitalPriceArs,
    uploaderDefaultDigitalPriceArs: uploaderDefault,
    platformMinDigitalPriceArs: album.platformMinDigitalPriceArs,
  });

  if (album.event && album.eventId != null && album.eventId > 0) {
    const resolution = resolveEventDigitalPhotoBasePrice({
      album: { digitalPhotoPriceCents: album.digitalPhotoPriceCents ?? undefined },
      event: album.event,
      currentResolvedBasePrice: legacyBase,
      albumOwnerUser: {
        defaultDigitalPhotoPrice: album.ownerDefaultDigitalPriceArs ?? null,
      },
      uploaderUser: {
        defaultDigitalPhotoPrice: uploaderDefault ?? album.ownerDefaultDigitalPriceArs ?? null,
      },
      photo: { id: photo.id },
      globalMinimumPrice: album.platformMinDigitalPriceArs,
    });
    legacyBase = Math.round(resolution.basePrice);
  }

  return legacyBase;
}

function unavailable(
  kind: GalleryPricingUnavailableKind,
  reason: string
): GalleryPricingSnapshot {
  return { kind, showBand: false, reason };
}

/**
 * Construye el snapshot de pricing para la banda de galería (MVP digital uniforme).
 * Usa la misma base y fee que el checkout (`clientTotalFromPhotographerBaseArs`).
 */
export function buildGalleryPricingSnapshot(
  album: GalleryPricingAlbumInput,
  photos: GalleryPricingPhotoInput[]
): GalleryPricingSnapshot {
  if (photos.length === 0) {
    return unavailable("NO_PHOTOS", "El álbum no tiene fotos visibles.");
  }

  if (!isAlbumSinglesPurchaseReady(album)) {
    return unavailable("SALES_NOT_READY", GALLERY_SALES_NOT_READY_MESSAGE);
  }

  if (album.enableDigitalPhotos === false) {
    return unavailable("NO_DIGITAL", "La venta digital no está habilitada en este álbum.");
  }

  if (hasMixedSellFormats(photos)) {
    return unavailable(
      "MIXED_FORMATS",
      "Las fotos tienen formatos de venta distintos entre sí."
    );
  }

  if (!photos.every((p) => p.sellDigital !== false)) {
    return unavailable(
      "MIXED_FORMATS",
      "No todas las fotos visibles se venden en formato digital."
    );
  }

  const feePercent = album.checkoutDigitalFeePercent;
  const clientPrices = new Set<number>();
  const basePrices = new Set<number>();

  for (const photo of photos) {
    const baseArs = resolvePhotoDigitalBaseArs(photo, album);
    if (!Number.isFinite(baseArs) || baseArs <= 0) {
      return unavailable(
        "PRICE_UNRESOLVED",
        "No se pudo resolver el precio digital de una o más fotos."
      );
    }
    basePrices.add(baseArs);
    clientPrices.add(clientTotalFromPhotographerBaseArs(baseArs, feePercent));
  }

  if (clientPrices.size !== 1) {
    return unavailable(
      "PRICE_UNRESOLVED",
      "El precio digital no es uniforme en todas las fotos visibles."
    );
  }

  const digitalUnitPriceArs = [...clientPrices][0]!;
  if (!Number.isFinite(digitalUnitPriceArs) || digitalUnitPriceArs <= 0) {
    return unavailable("PRICE_UNRESOLVED", "El precio digital final no es válido.");
  }

  return {
    kind: "DIGITAL_UNIFORM",
    showBand: true,
    digitalUnitPriceArs,
    digitalUnitPriceLabel: formatPurchaseArs(digitalUnitPriceArs),
    discountLabel: buildDigitalBulkDiscountBenefitsLabel(album),
    discounts: buildStructuredDigitalDiscounts(album),
    enablePrintedPhotos: isLegacyAlbumPrintSalesEnabled(album.enablePrintedPhotos),
    digitalDiscount5Plus: album.digitalDiscount5Plus ?? null,
    digitalDiscount10Plus: album.digitalDiscount10Plus ?? null,
    digitalDiscount20Plus: album.digitalDiscount20Plus ?? null,
  };
}
