import {
  buildDownloadCenterUrl,
  buildZipDownloadApiUrl,
} from "@/lib/digital-download/download-center-url";

/** Valor por defecto si no está definido `DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS`. */
export const DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS_DEFAULT = 48;

const LOG_ACTIVE = "DOWNLOAD_CENTER_ROLLOUT_ACTIVE";
const LOG_LEGACY = "DOWNLOAD_CENTER_ROLLOUT_LEGACY";

export function getDigitalDownloadCenterRolloutHours(): number {
  const raw = process.env.DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS;
  if (raw === undefined || raw.trim() === "") {
    return DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS_DEFAULT;
  }
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < 0) {
    return DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS_DEFAULT;
  }
  return hours;
}

export function isDownloadCenterRolloutActive(
  orderCreatedAt: Date,
  now: Date = new Date()
): boolean {
  const hours = getDigitalDownloadCenterRolloutHours();
  const cutoffMs = now.getTime() - hours * 60 * 60 * 1000;
  return orderCreatedAt.getTime() >= cutoffMs;
}

export function logDownloadCenterRolloutDecision(params: {
  orderId: number;
  orderCreatedAt: Date;
  context: string;
  now?: Date;
}): boolean {
  const rolloutActive = isDownloadCenterRolloutActive(
    params.orderCreatedAt,
    params.now
  );
  const payload = {
    orderId: params.orderId,
    orderCreatedAt: params.orderCreatedAt.toISOString(),
    context: params.context,
    rolloutHours: getDigitalDownloadCenterRolloutHours(),
  };
  if (rolloutActive) {
    console.info(LOG_ACTIVE, payload);
  } else {
    console.info(LOG_LEGACY, payload);
  }
  return rolloutActive;
}

export type ClientDigitalDownloadLinks = {
  rolloutActive: boolean;
  downloadCenterUrl: string | null;
  legacyDownloadUrl: string;
  /** URL principal para el cliente según rollout (centro o legacy). */
  primaryClientUrl: string;
};

export function resolveClientDigitalDownloadLinks(params: {
  orderId: number;
  orderCreatedAt: Date;
  accessToken: string;
  baseUrl: string;
  context: string;
}): ClientDigitalDownloadLinks {
  const rolloutActive = logDownloadCenterRolloutDecision({
    orderId: params.orderId,
    orderCreatedAt: params.orderCreatedAt,
    context: params.context,
  });
  const legacyDownloadUrl = buildZipDownloadApiUrl(params.accessToken, params.baseUrl);
  const downloadCenterUrl = rolloutActive
    ? buildDownloadCenterUrl(params.accessToken, params.baseUrl)
    : null;

  return {
    rolloutActive,
    downloadCenterUrl,
    legacyDownloadUrl,
    primaryClientUrl: downloadCenterUrl ?? legacyDownloadUrl,
  };
}
