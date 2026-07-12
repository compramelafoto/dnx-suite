/**
 * Mapeo comercial editorial (CTA) a partir de disponibilidad CLF / snapshot.
 */

import {
  resolveClfAlbumCommercialAvailability,
  type ClfAlbumAvailabilityInput,
} from "@repo/db";

export type EditorialCommercialStatus =
  | "AVAILABLE"
  | "HIDDEN"
  | "UNPUBLISHED"
  | "DELETED"
  | "UNKNOWN";

export function mapClfAvailabilityToEditorialCommercial(
  status: string,
): EditorialCommercialStatus {
  switch (status) {
    case "AVAILABLE":
      return "AVAILABLE";
    case "REACTIVATABLE":
      return "HIDDEN";
    case "UNAVAILABLE":
      return "DELETED";
    default:
      return "UNKNOWN";
  }
}

export function resolveEditorialCommercialFromAlbum(
  album: ClfAlbumAvailabilityInput,
): {
  status: EditorialCommercialStatus;
  albumUrl: string | null;
  purchaseUrl: string | null;
  canShowPurchaseCta: boolean;
  reason: string;
} {
  const avail = resolveClfAlbumCommercialAvailability(album);
  const status = mapClfAvailabilityToEditorialCommercial(avail.status);
  const canShow = status === "AVAILABLE";
  return {
    status,
    albumUrl: canShow || status === "HIDDEN" ? avail.publicUrl : null,
    purchaseUrl: canShow ? avail.publicUrl : null,
    canShowPurchaseCta: canShow,
    reason: avail.reason,
  };
}
