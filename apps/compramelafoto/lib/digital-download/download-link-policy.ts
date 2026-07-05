/**
 * Política de vigencia de links de descarga digital.
 * Los días totales vienen de AppConfig.downloadLinkDays (admin).
 *
 * Default 15 días: el comprador descarga antes de que el álbum se oculte (día 30)
 * o se elimine (día 45).
 */

/** Valor por defecto cuando AppConfig no define downloadLinkDays. */
export const DEFAULT_DOWNLOAD_LINK_DAYS = 15;

/** Días restantes para mostrar estado "próximo a vencer". */
export const DOWNLOAD_EXPIRING_SOON_DAYS = 7;

export type DownloadAvailabilityStatus = "available" | "expiring_soon" | "expired";

export function resolveDownloadLinkDays(
  config: { downloadLinkDays?: number | null } | null | undefined
): number {
  const days = Number(config?.downloadLinkDays ?? DEFAULT_DOWNLOAD_LINK_DAYS);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_DOWNLOAD_LINK_DAYS;
}

export function formatDownloadExpiryDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function computeDownloadAvailability(expiresAt: Date): {
  status: DownloadAvailabilityStatus;
  daysRemaining: number;
  expiresAtIso: string;
  expiresAtLabel: string;
} {
  const expiresAtLabel = formatDownloadExpiryDate(expiresAt);
  const expiresAtIso = expiresAt.toISOString();
  const msRemaining = expiresAt.getTime() - Date.now();

  if (msRemaining <= 0) {
    return {
      status: "expired",
      daysRemaining: 0,
      expiresAtIso,
      expiresAtLabel,
    };
  }

  const daysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  if (daysRemaining <= DOWNLOAD_EXPIRING_SOON_DAYS) {
    return {
      status: "expiring_soon",
      daysRemaining,
      expiresAtIso,
      expiresAtLabel,
    };
  }

  return {
    status: "available",
    daysRemaining,
    expiresAtIso,
    expiresAtLabel,
  };
}
