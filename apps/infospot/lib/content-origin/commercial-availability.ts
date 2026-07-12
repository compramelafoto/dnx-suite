/**
 * Contrato de disponibilidad comercial para orígenes (álbum/evento CLF, etc.).
 *
 * Distinción crítica:
 * - Comercial (CTA / compra): se oculta si el álbum fue eliminado / no disponible.
 * - Imagen editorial: puede conservarse si hay licencia vigente (otra etapa).
 */

import {
  resolveClfAlbumCommercialAvailability,
  type ClfAlbumAvailabilityInput,
  type ClfAlbumAvailabilityOptions,
} from "@repo/db";
import type { ContentOriginRecord, OperationalPayload } from "./types";

export const COMMERCIAL_AVAILABILITY_STATUSES = [
  "AVAILABLE",
  "HIDDEN",
  "UNPUBLISHED",
  "DELETED",
  "UNKNOWN",
] as const;

export type CommercialAvailabilityStatus =
  (typeof COMMERCIAL_AVAILABILITY_STATUSES)[number];

export type CommercialAvailabilityResult = {
  status: CommercialAvailabilityStatus;
  canShowPurchaseCta: boolean;
  canShowPublicLink: boolean;
  publicUrl: string | null;
  reason: string;
};

function fromClfAlbumStatus(
  status: string,
  publicUrl: string,
  reason: string,
): CommercialAvailabilityResult {
  switch (status) {
    case "AVAILABLE":
      return {
        status: "AVAILABLE",
        canShowPurchaseCta: true,
        canShowPublicLink: true,
        publicUrl,
        reason,
      };
    case "REACTIVATABLE":
      return {
        status: "HIDDEN",
        canShowPurchaseCta: false,
        canShowPublicLink: false,
        publicUrl,
        reason,
      };
    case "UNAVAILABLE":
      return {
        status: "DELETED",
        canShowPurchaseCta: false,
        canShowPublicLink: false,
        publicUrl: null,
        reason,
      };
    default:
      return {
        status: "UNKNOWN",
        canShowPurchaseCta: false,
        canShowPublicLink: false,
        publicUrl: null,
        reason: reason || "Estado comercial desconocido",
      };
  }
}

/** Resuelve disponibilidad a partir del snapshot operativo del origen. */
export function resolveCommercialAvailability(
  origin: Pick<
    ContentOriginRecord,
    "sourceType" | "externalEntityType" | "syncStatus" | "operationalPayload" | "externalUrl"
  >,
  options?: ClfAlbumAvailabilityOptions,
): CommercialAvailabilityResult {
  if (origin.syncStatus === "DISABLED" || origin.syncStatus === "STALE") {
    return {
      status: origin.syncStatus === "STALE" ? "UNPUBLISHED" : "DELETED",
      canShowPurchaseCta: false,
      canShowPublicLink: false,
      publicUrl: null,
      reason:
        origin.syncStatus === "STALE"
          ? "Origen marcado STALE (p. ej. álbum eliminado en la fuente)."
          : "Origen deshabilitado.",
    };
  }

  const payload = (origin.operationalPayload || {}) as OperationalPayload;

  if (
    origin.sourceType === "COMPRAMELAFOTO" &&
    origin.externalEntityType === "ALBUM" &&
    typeof payload.publicSlug === "string"
  ) {
    const album: ClfAlbumAvailabilityInput = {
      publicSlug: payload.publicSlug,
      isHidden: Boolean(payload.isHidden),
      isPublic: payload.isPublic !== false,
      deletedAt: payload.deletedAt ? new Date(String(payload.deletedAt)) : null,
      firstPhotoDate: payload.firstPhotoDate
        ? new Date(String(payload.firstPhotoDate))
        : null,
      createdAt: payload.createdAt
        ? new Date(String(payload.createdAt))
        : new Date(0),
      expirationExtensionDays:
        typeof payload.expirationExtensionDays === "number"
          ? payload.expirationExtensionDays
          : null,
      cleanupStatus:
        typeof payload.cleanupStatus === "string" ? payload.cleanupStatus : null,
      storagePurged: Boolean(payload.storagePurged),
    };
    const avail = resolveClfAlbumCommercialAvailability(album, options);
    return fromClfAlbumStatus(avail.status, avail.publicUrl, avail.reason);
  }

  if (payload.commercialStatus === "DELETED" || payload.deleted === true) {
    return {
      status: "DELETED",
      canShowPurchaseCta: false,
      canShowPublicLink: false,
      publicUrl: null,
      reason: "Marcado eliminado en operationalPayload.",
    };
  }

  return {
    status: "UNKNOWN",
    canShowPurchaseCta: false,
    canShowPublicLink: Boolean(origin.externalUrl),
    publicUrl: origin.externalUrl,
    reason: "Sin datos comerciales suficientes en el snapshot.",
  };
}
