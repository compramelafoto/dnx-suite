import { prisma } from "@/lib/prisma";
import { createClientDownloadToken } from "@/lib/download-tokens";
import { getAppConfig } from "@/lib/services/settingsService";
import { safeFilename } from "@/lib/safe-filename";
import {
  computeDownloadAvailability,
  formatDownloadExpiryDate,
  resolveDownloadLinkDays,
  type DownloadAvailabilityStatus,
} from "@/lib/digital-download/download-link-policy";
import {
  buildDownloadCenterPreviewPath,
  buildPhotoDownloadApiUrl,
  buildZipDownloadApiUrl,
} from "@/lib/digital-download/download-center-url";

export type DownloadCenterPhoto = {
  photoId: number;
  filename: string;
  previewUrl: string;
  downloadUrl: string;
};

export type DownloadCenterZipState =
  | { status: "not_applicable" }
  | { status: "preparing"; progressPercent: number | null; currentStep: string | null }
  | { status: "ready"; downloadUrl: string }
  | { status: "error" };

export type DownloadCenterData = {
  orderId: number;
  accessToken: string;
  albumTitle: string | null;
  photographerName: string | null;
  photographerEmail: string | null;
  purchasedAtLabel: string;
  photoCount: number;
  photos: DownloadCenterPhoto[];
  availability: {
    status: DownloadAvailabilityStatus;
    daysRemaining: number;
    expiresAtLabel: string;
    expiresAtIso: string;
  };
  zip: DownloadCenterZipState;
  supportUrl: string;
};

function buildFilename(originalKey: string | null, photoId: number): string {
  const raw = originalKey?.split("/").pop()?.trim();
  if (raw) return safeFilename(raw, `foto-${photoId}.jpg`);
  return `foto-${photoId}.jpg`;
}

async function resolveOrderAccessToken(
  orderId: number,
  albumId: number,
  expiresAt: Date
): Promise<string | null> {
  const tokens = await prisma.orderDownloadToken.findMany({
    where: { orderId, type: "CLIENT_DIGITAL" },
    orderBy: { createdAt: "desc" },
  });

  const orderLevel = tokens.find((t) => !t.photoId);
  if (orderLevel) return orderLevel.token;

  if (expiresAt.getTime() <= Date.now()) {
    return tokens[0]?.token ?? null;
  }

  return createClientDownloadToken({
    orderId,
    albumId,
    expiresAt,
  });
}

function mapZipJob(
  job: {
    status: string;
    progress: number | null;
    meta: unknown;
  } | null,
  zipDownloadUrl: string | null,
  photoCount: number
): DownloadCenterZipState {
  if (photoCount <= 1) {
    return { status: "not_applicable" };
  }
  if (!job) {
    return { status: "preparing", progressPercent: null, currentStep: null };
  }

  const meta = (job.meta ?? {}) as Record<string, unknown>;
  const currentStep =
    typeof meta.currentStep === "string" ? meta.currentStep : null;

  if (job.status === "COMPLETED" && zipDownloadUrl) {
    return { status: "ready", downloadUrl: zipDownloadUrl };
  }
  if (job.status === "FAILED") {
    return { status: "error" };
  }

  return {
    status: "preparing",
    progressPercent: typeof job.progress === "number" ? job.progress : null,
    currentStep,
  };
}

export async function loadDownloadCenterByToken(
  tokenParam: string,
  baseUrl?: string
): Promise<DownloadCenterData | null> {
  const tokenRecord = await prisma.orderDownloadToken.findUnique({
    where: { token: tokenParam },
  });

  if (!tokenRecord || tokenRecord.type !== "CLIENT_DIGITAL" || !tokenRecord.orderId) {
    return null;
  }

  const order = await prisma.order.findUnique({
    where: { id: tokenRecord.orderId },
    select: {
      id: true,
      status: true,
      albumId: true,
      createdAt: true,
      album: {
        select: {
          id: true,
          title: true,
          deletedAt: true,
          user: { select: { name: true, email: true } },
        },
      },
      items: {
        where: { productType: "DIGITAL" },
        select: {
          photoId: true,
          photo: { select: { id: true, originalKey: true } },
        },
      },
    },
  });

  if (!order || order.status !== "PAID" || !order.albumId) {
    return null;
  }

  const config = await getAppConfig();
  const downloadDays = resolveDownloadLinkDays(config);

  const allTokens = await prisma.orderDownloadToken.findMany({
    where: { orderId: order.id, type: "CLIENT_DIGITAL" },
    orderBy: { createdAt: "desc" },
  });

  const orderLevelToken = allTokens.find((t) => !t.photoId);
  const expiresAt =
    orderLevelToken?.expiresAt ??
    tokenRecord.expiresAt ??
    new Date(Date.now() + downloadDays * 24 * 60 * 60 * 1000);

  const accessToken =
    orderLevelToken?.token ??
    (await resolveOrderAccessToken(order.id, order.albumId, expiresAt));

  if (!accessToken) {
    return null;
  }

  const albumDeleted = Boolean(order.album?.deletedAt);
  const availability = computeDownloadAvailability(expiresAt);
  const effectiveStatus: DownloadAvailabilityStatus = albumDeleted
    ? "expired"
    : availability.status;

  const zipJob = await prisma.zipGenerationJob.findFirst({
    where: {
      orderId: order.id,
      type: "ORDER_DOWNLOAD",
      status: { in: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, progress: true, meta: true },
  });

  const zipDownloadUrl =
    effectiveStatus !== "expired"
      ? buildZipDownloadApiUrl(accessToken, baseUrl)
      : null;

  const photos: DownloadCenterPhoto[] = [];
  const seenPhotoIds = new Set<number>();

  for (const item of order.items) {
    if (!Number.isFinite(item.photoId)) continue;
    const photoId = Number(item.photoId);
    if (seenPhotoIds.has(photoId)) continue;
    seenPhotoIds.add(photoId);

    const perPhotoToken =
      allTokens.find((t) => t.photoId === photoId)?.token ??
      (effectiveStatus !== "expired"
        ? await createClientDownloadToken({
            orderId: order.id,
            albumId: order.albumId,
            photoId,
            expiresAt,
          })
        : null);

    photos.push({
      photoId,
      filename: buildFilename(item.photo?.originalKey ?? null, photoId),
      previewUrl: buildDownloadCenterPreviewPath(accessToken, photoId),
      downloadUrl: perPhotoToken
        ? buildPhotoDownloadApiUrl(perPhotoToken, baseUrl)
        : "#",
    });
  }

  photos.sort((a, b) => a.photoId - b.photoId);

  const appBase =
    baseUrl ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

  return {
    orderId: order.id,
    accessToken,
    albumTitle: order.album?.title ?? null,
    photographerName: order.album?.user?.name ?? null,
    photographerEmail: order.album?.user?.email ?? null,
    purchasedAtLabel: formatDownloadExpiryDate(order.createdAt),
    photoCount: photos.length,
    photos,
    availability: {
      status: effectiveStatus,
      daysRemaining: albumDeleted ? 0 : availability.daysRemaining,
      expiresAtLabel: availability.expiresAtLabel,
      expiresAtIso: availability.expiresAtIso,
    },
    zip: mapZipJob(zipJob, zipDownloadUrl, photos.length),
    supportUrl: `${appBase.replace(/\/$/, "")}/cliente/soporte`,
  };
}

/** Obtiene el token de acceso al centro para un pedido pagado (si existe). */
export async function getOrderDownloadCenterAccessToken(
  orderId: number
): Promise<string | null> {
  const tokens = await prisma.orderDownloadToken.findMany({
    where: {
      orderId,
      type: "CLIENT_DIGITAL",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  const orderLevel = tokens.find((t) => !t.photoId);
  return orderLevel?.token ?? tokens[0]?.token ?? null;
}
