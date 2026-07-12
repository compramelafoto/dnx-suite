/**
 * Resolución comercial + CTA a partir de snapshot de álbum.
 */

import {
  resolveClfAlbumCommercialAvailability,
  type ClfAlbumAvailabilityOptions,
} from "@repo/db";
import type { CoverageAlbumSnapshot } from "./types";

export type CoverageCommercialView = {
  status: string;
  canShowPurchaseCta: boolean;
  canShowPublicLink: boolean;
  publicUrl: string | null;
  reason: string;
};

export function resolveCoverageCommercial(
  album: Pick<
    CoverageAlbumSnapshot,
    | "publicSlug"
    | "isPublic"
    | "isHidden"
    | "deletedAt"
    | "firstPhotoDate"
    | "createdAt"
    | "expirationExtensionDays"
    | "cleanupStatus"
  >,
  options?: ClfAlbumAvailabilityOptions,
): CoverageCommercialView {
  if (!album.isPublic && !album.isHidden) {
    return {
      status: "UNAVAILABLE",
      canShowPurchaseCta: false,
      canShowPublicLink: false,
      publicUrl: null,
      reason: "Álbum no público en CLF.",
    };
  }

  const avail = resolveClfAlbumCommercialAvailability(
    {
      publicSlug: album.publicSlug,
      isHidden: album.isHidden,
      isPublic: album.isPublic,
      deletedAt: album.deletedAt,
      firstPhotoDate: album.firstPhotoDate,
      createdAt: album.createdAt,
      expirationExtensionDays: album.expirationExtensionDays,
      cleanupStatus: album.cleanupStatus,
    },
    options,
  );

  return {
    status: avail.status,
    canShowPurchaseCta: avail.canPurchase,
    canShowPublicLink: avail.status === "AVAILABLE",
    publicUrl: avail.publicUrl,
    reason: avail.reason,
  };
}

/** Álbum oculto o no disponible → no hay CTA comercial. */
export function shouldHidePurchaseCta(commercial: CoverageCommercialView): boolean {
  return !commercial.canShowPurchaseCta;
}
