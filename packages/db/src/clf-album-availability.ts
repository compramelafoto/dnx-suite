/**
 * Disponibilidad comercial de álbumes CLF (compartido).
 *
 * Alineado con apps/compramelafoto/lib/album-cleanup/eligibility.ts:
 * - ancla: firstPhotoDate
 * - hide: hideAfterDays (default 30) + expirationExtensionDays
 * - purge: retentionDays (default 45) + expirationExtensionDays
 *
 * No importa código de apps/compramelafoto.
 */

const MS_PER_DAY = 86_400_000;

export type ClfAlbumCommercialStatus = "AVAILABLE" | "REACTIVATABLE" | "UNAVAILABLE";

export type ClfAlbumAvailabilityInput = {
  publicSlug: string;
  isHidden: boolean;
  isPublic: boolean;
  deletedAt: Date | null;
  firstPhotoDate: Date | null;
  createdAt: Date;
  expirationExtensionDays: number | null;
  cleanupStatus?: string | null;
  storagePurged?: boolean;
};

export type ClfAlbumAvailabilityResult = {
  status: ClfAlbumCommercialStatus;
  canPurchase: boolean;
  canRequestReactivation: boolean;
  publicUrl: string;
  hiddenAt: Date | null;
  reactivationDeadline: Date | null;
  reason: string;
};

export type ClfAlbumAvailabilityOptions = {
  now?: Date;
  hideAfterDays?: number;
  retentionDays?: number;
  /** Base URL de ComprameLaFoto sin trailing slash (ej. https://compramelafoto.com). */
  clfPublicBaseUrl?: string;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function resolveHideAfterDays(options?: ClfAlbumAvailabilityOptions): number {
  if (typeof options?.hideAfterDays === "number") {
    return clampInt(options.hideAfterDays, 7, 120);
  }
  return clampInt(Number(process.env.ALBUM_CLEANUP_HIDE_DAYS ?? 30), 7, 120);
}

function resolveRetentionDays(options?: ClfAlbumAvailabilityOptions): number {
  if (typeof options?.retentionDays === "number") {
    return clampInt(options.retentionDays, 30, 365);
  }
  return clampInt(Number(process.env.ALBUM_CLEANUP_RETENTION_DAYS ?? 45), 30, 365);
}

function baseDate(album: ClfAlbumAvailabilityInput): Date {
  return album.firstPhotoDate ?? album.createdAt;
}

function buildAlbumPublicUrl(publicSlug: string, baseUrl?: string): string {
  const base =
    baseUrl?.replace(/\/$/, "") ||
    process.env.COMPRAMELAFOTO_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_COMPRAMELAFOTO_URL?.replace(/\/$/, "") ||
    "https://compramelafoto.com";
  return `${base}/album/${publicSlug}`;
}

export function resolveClfAlbumCommercialAvailability(
  album: ClfAlbumAvailabilityInput,
  options?: ClfAlbumAvailabilityOptions,
): ClfAlbumAvailabilityResult {
  const now = options?.now ?? new Date();
  const hideAfterDays = resolveHideAfterDays(options);
  const retentionDays = resolveRetentionDays(options);
  const extension = album.expirationExtensionDays ?? 0;
  const anchor = baseDate(album);
  const hiddenAt = new Date(anchor.getTime() + (hideAfterDays + extension) * MS_PER_DAY);
  const reactivationDeadline = new Date(
    anchor.getTime() + (retentionDays + extension) * MS_PER_DAY,
  );
  const publicUrl = buildAlbumPublicUrl(album.publicSlug, options?.clfPublicBaseUrl);

  if (album.deletedAt || album.storagePurged) {
    return {
      status: "UNAVAILABLE",
      canPurchase: false,
      canRequestReactivation: false,
      publicUrl,
      hiddenAt,
      reactivationDeadline,
      reason: "El álbum fue eliminado o su almacenamiento fue purgado.",
    };
  }

  const cleanup = album.cleanupStatus ?? "NONE";
  if (
    cleanup === "COMPLETED" ||
    cleanup === "COMPLETED_WITH_REFERENCES" ||
    cleanup === "PROCESSING" ||
    cleanup === "PENDING"
  ) {
    return {
      status: "UNAVAILABLE",
      canPurchase: false,
      canRequestReactivation: false,
      publicUrl,
      hiddenAt,
      reactivationDeadline,
      reason: "El álbum está en proceso de limpieza o ya fue purgado.",
    };
  }

  const pastHide = now.getTime() >= hiddenAt.getTime();
  const pastPurge = now.getTime() >= reactivationDeadline.getTime();

  if (album.isHidden || pastHide) {
    if (pastPurge) {
      return {
        status: "UNAVAILABLE",
        canPurchase: false,
        canRequestReactivation: false,
        publicUrl,
        hiddenAt,
        reactivationDeadline,
        reason: "Pasó el período de reactivación (~45 días + extensiones).",
      };
    }
    return {
      status: "REACTIVATABLE",
      canPurchase: false,
      canRequestReactivation: true,
      publicUrl,
      hiddenAt,
      reactivationDeadline,
      reason: "El álbum está oculto pero aún puede solicitarse reactivación.",
    };
  }

  if (!album.isPublic) {
    return {
      status: "UNAVAILABLE",
      canPurchase: false,
      canRequestReactivation: false,
      publicUrl,
      hiddenAt,
      reactivationDeadline,
      reason: "El álbum no está marcado como público.",
    };
  }

  return {
    status: "AVAILABLE",
    canPurchase: true,
    canRequestReactivation: false,
    publicUrl,
    hiddenAt,
    reactivationDeadline,
    reason: "Álbum visible y dentro de la ventana comercial.",
  };
}
