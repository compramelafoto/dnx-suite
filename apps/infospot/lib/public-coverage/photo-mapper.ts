/**
 * Mapea InfoSpotEditorialPhoto (+ usage) → view model público seguro.
 */

import { getEditorialPhotoDelivery } from "../editorial-photo-processing/delivery";
import { buildTrackedHref } from "./tracking-href";
import type { PublicEditorialPhotoViewModel } from "./types";

type PhotoRow = {
  id: string;
  photographerName: string;
  credit: string;
  commercialStatus: string;
  editorialLicenseStatus: string;
  processStatus: string;
  purchaseUrl: string | null;
  albumUrl: string | null;
  photographerProfileUrl: string | null;
  variants: Array<{ width: number; format: string; url: string }>;
};

type UsageRow = {
  usageType: "COVER" | "INLINE" | "GALLERY" | "FEATURED";
  sortOrder: number;
  caption: string | null;
  altText: string | null;
  displaySize: string | null;
  photo: PhotoRow;
};

export function toPublicEditorialPhoto(
  usage: UsageRow,
  ctx: { articleId: string; eventId?: string | null },
): PublicEditorialPhotoViewModel {
  const photo = usage.photo;
  const revoked = photo.editorialLicenseStatus === "REVOKED";
  const unavailable =
    revoked ||
    photo.processStatus === "UNAVAILABLE" ||
    photo.processStatus === "FAILED" ||
    photo.processStatus === "PROCESSING" ||
    photo.processStatus === "PENDING";

  const showable =
    !revoked &&
    photo.editorialLicenseStatus === "AUTHORIZED" &&
    photo.processStatus === "READY" &&
    photo.variants.length > 0;

  const delivery = showable
    ? getEditorialPhotoDelivery(photo.variants)
    : { src: "", srcSet: undefined, sizes: "(max-width: 768px) 100vw, 960px" };

  const canBuy =
    !revoked &&
    photo.commercialStatus === "AVAILABLE" &&
    Boolean(photo.purchaseUrl || photo.albumUrl);

  const hasSpecificPurchaseUrl = Boolean(photo.purchaseUrl?.trim());
  const albumTarget = photo.albumUrl;

  return {
    id: photo.id,
    usageType: usage.usageType,
    sortOrder: usage.sortOrder,
    caption: usage.caption,
    altText: usage.altText?.trim() || photo.photographerName || "Fotografía editorial",
    displaySize: usage.displaySize || "wide",
    photographerName: photo.photographerName,
    credit: photo.credit,
    src: showable ? delivery.src || null : null,
    srcSet: showable ? delivery.srcSet || null : null,
    sizes: delivery.sizes,
    widthHint: photo.variants.find((v) => v.format === "webp")?.width ?? null,
    revoked,
    unavailable: unavailable || !showable,
    canShowPurchaseCta: canBuy,
    hasSpecificPurchaseUrl,
    purchaseHref:
      canBuy && hasSpecificPurchaseUrl && photo.purchaseUrl
        ? buildTrackedHref({
            to: photo.purchaseUrl,
            kind: "PURCHASE_CLICK",
            articleId: ctx.articleId,
            eventId: ctx.eventId,
          })
        : null,
    albumHref:
      albumTarget && photo.commercialStatus === "AVAILABLE"
        ? buildTrackedHref({
            to: albumTarget,
            kind: "ALBUM_CLICK",
            articleId: ctx.articleId,
            eventId: ctx.eventId,
          })
        : null,
    photographerProfileHref: photo.photographerProfileUrl,
  };
}
