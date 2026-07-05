import type { PrismaClient } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import {
  buildGalleryPricingSnapshot,
  type GalleryPricingPhotoInput,
  type GalleryPricingSnapshot,
} from "@/lib/pricing/gallery-pricing-snapshot";

export type AlbumRowForGalleryPricing = {
  userId: number;
  eventId: number | null;
  enableDigitalPhotos: boolean;
  enablePrintedPhotos: boolean;
  digitalPhotoPriceCents: number | null;
  albumProfitMarginPercent?: number | null;
  selectedLabId?: number | null;
  pickupBy?: string | null;
  printPricingSource?: string | null;
  termsAcceptedAt?: Date | string | null;
  termsVersion?: string | null;
  digitalDiscount5Plus: number | null;
  digitalDiscount10Plus: number | null;
  digitalDiscount20Plus: number | null;
  includeDigitalWithPrint: boolean | null;
  digitalWithPrintDiscountPercent: number | null;
  photos: GalleryPricingPhotoInput[];
  user: { defaultDigitalPhotoPrice: number | null } | null;
};

/**
 * Resuelve contexto de DB (evento, uploaders, mínimo plataforma) y construye el snapshot.
 */
export async function loadGalleryPricingSnapshot(
  prisma: PrismaClient,
  album: AlbumRowForGalleryPricing,
  checkoutDigitalFeePercent: number
): Promise<GalleryPricingSnapshot> {
  const appConfig = await getAppConfig();
  const platformMinDigitalPriceArs = appConfig?.minDigitalPhotoPrice ?? 5000;

  let event: {
    photoPricingMode: import("@prisma/client").EventPhotoPricingMode;
    fixedPhotoPrice: number | null;
    minimumPhotoPrice: number | null;
  } | null = null;

  if (album.eventId != null && album.eventId > 0) {
    event = await prisma.event.findUnique({
      where: { id: album.eventId },
      select: {
        photoPricingMode: true,
        fixedPhotoPrice: true,
        minimumPhotoPrice: true,
      },
    });
  }

  const uploaderIds = new Set<number>();
  for (const photo of album.photos) {
    const uid = photo.userId ?? album.userId;
    if (uid != null) uploaderIds.add(uid);
  }
  uploaderIds.add(album.userId);

  const uploaderUsers =
    uploaderIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...uploaderIds] } },
          select: { id: true, defaultDigitalPhotoPrice: true },
        })
      : [];

  const uploaderDefaultDigitalPriceArsByUserId: Record<number, number | null> = {};
  for (const u of uploaderUsers) {
    uploaderDefaultDigitalPriceArsByUserId[u.id] = u.defaultDigitalPhotoPrice;
  }

  return buildGalleryPricingSnapshot(
    {
      userId: album.userId,
      eventId: album.eventId,
      enableDigitalPhotos: album.enableDigitalPhotos,
      enablePrintedPhotos: album.enablePrintedPhotos,
      digitalPhotoPriceCents: album.digitalPhotoPriceCents,
      digitalDiscount5Plus: album.digitalDiscount5Plus,
      digitalDiscount10Plus: album.digitalDiscount10Plus,
      digitalDiscount20Plus: album.digitalDiscount20Plus,
      includeDigitalWithPrint: album.includeDigitalWithPrint,
      digitalWithPrintDiscountPercent: album.digitalWithPrintDiscountPercent,
      checkoutDigitalFeePercent,
      platformMinDigitalPriceArs,
      ownerDefaultDigitalPriceArs: album.user?.defaultDigitalPhotoPrice ?? null,
      event,
      uploaderDefaultDigitalPriceArsByUserId,
    },
    album.photos
  );
}
