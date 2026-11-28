import { prisma } from "@/lib/prisma";
import { createClientDownloadToken } from "@/lib/download-tokens";
import { createZipJob, getZipExpiresAt } from "@/lib/zip-job-queue";
import {
  GROWING_PACK_ZIP_META,
  mergeOrderDigitalPhotoIds,
  zipJobCoversPhotos,
} from "@/lib/digital-download/order-digital-photo-ids";
import {
  buildDownloadCenterVideos,
  type DownloadCenterVideo,
} from "@/lib/videos/download-center-videos";
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
import { parseDesignV2Data } from "@/lib/design-v2/design-data";

export type DownloadCenterPhoto = {
  photoId: number;
  filename: string;
  previewUrl: string;
  downloadUrl: string;
  /** Sumada después de pagar y todavía no vista en el panel (pack que se va sumando). */
  isNew?: boolean;
};

export type DownloadCenterZipState =
  | { status: "not_applicable" }
  | { status: "preparing"; progressPercent: number | null; currentStep: string | null }
  | { status: "ready"; downloadUrl: string }
  | { status: "error" };

export type DownloadCenterDesign = {
  id: number;
  name: string;
  pdfUrl: string | null;
  /** Una imagen por cara, en orden. */
  jpgUrls: string[];
};

export type DownloadCenterData = {
  orderId: number;
  accessToken: string;
  albumTitle: string | null;
  photographerName: string | null;
  photographerEmail: string | null;
  purchasedAtLabel: string;
  photoCount: number;
  photos: DownloadCenterPhoto[];
  /** Pack «Todas mis fotos» de un evento de varios días: el panel sigue sumando fotos. */
  growingPack: { active: boolean; newCount: number } | null;
  /** Videos comprados en el mismo pedido. Cada uno se baja por su cuenta. */
  videos: DownloadCenterVideo[];
  /** Diseños con las fotos elegidas (carpeta, póster…), cuando el fotógrafo ya los aprobó. */
  designs: DownloadCenterDesign[];
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
      addedPhotos: {
        where: { removedByClientAt: null },
        select: {
          photoId: true,
          addedAt: true,
          photo: { select: { id: true, originalKey: true } },
        },
        orderBy: { id: "asc" },
      },
      growingPackFace: {
        select: { id: true, panelSeenAt: true, endedAt: true, biometricDeletedAt: true },
      },
      videoItems: {
        select: {
          videoId: true,
          videoTitle: true,
          video: {
            select: {
              id: true,
              originalKey: true,
              durationSeconds: true,
              thumbnailKey: true,
            },
          },
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

  let zipJob = await prisma.zipGenerationJob.findFirst({
    where: {
      orderId: order.id,
      type: "ORDER_DOWNLOAD",
      status: { in: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, progress: true, meta: true, photoIds: true },
  });

  const zipDownloadUrl =
    effectiveStatus !== "expired"
      ? buildZipDownloadApiUrl(accessToken, baseUrl)
      : null;

  const photos: DownloadCenterPhoto[] = [];
  const seenPhotoIds = new Set<number>();

  const panelSeenAt = order.growingPackFace?.panelSeenAt ?? null;
  const addedAtByPhotoId = new Map(order.addedPhotos.map((a) => [a.photoId, a.addedAt]));
  const photoRows = [
    ...order.items,
    ...order.addedPhotos.map((a) => ({ photoId: a.photoId, photo: a.photo })),
  ];

  for (const item of photoRows) {
    if (!Number.isFinite(item.photoId)) continue;
    const photoId = Number(item.photoId);
    if (seenPhotoIds.has(photoId)) continue;
    seenPhotoIds.add(photoId);
    const addedAt = addedAtByPhotoId.get(photoId);

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
      ...(addedAt ? { isNew: !panelSeenAt || addedAt.getTime() > panelSeenAt.getTime() } : {}),
    });
  }

  // Las nuevas primero, para que el comprador las vea al entrar.
  photos.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || a.photoId - b.photoId);

  const growingFace = order.growingPackFace;
  const growingPack = growingFace
    ? {
        active: !growingFace.endedAt && !growingFace.biometricDeletedAt && !albumDeleted,
        newCount: photos.filter((p) => p.isNew).length,
      }
    : null;
  if (growingFace) {
    // Desde ahora, las que ya vio dejan de figurar como «Nuevas» en la próxima visita.
    await prisma.growingPackFace.update({
      where: { id: growingFace.id },
      data: { panelSeenAt: new Date() },
    });
  }

  // Se sumaron fotos después de armar el ZIP: ese ZIP quedó corto. Se arma otro con todas
  // (sin volver a mandar el mail de descarga) y mientras tanto se muestra «en preparación».
  if (
    order.addedPhotos.length > 0 &&
    photos.length > 1 &&
    effectiveStatus !== "expired" &&
    !(zipJob && zipJobCoversPhotos(zipJob.photoIds, photos.map((p) => p.photoId)))
  ) {
    zipJob = await createZipJob({
      type: "ORDER_DOWNLOAD",
      orderId: order.id,
      albumId: order.albumId,
      photoIds: mergeOrderDigitalPhotoIds(
        order.items.map((i) => i.photoId),
        order.addedPhotos.map((a) => a.photoId)
      ),
      meta: GROWING_PACK_ZIP_META,
      expiresAt: getZipExpiresAt(),
    });
  }

  const designs = await loadApprovedDesignsForOrder(order.id);

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
    growingPack,
    videos: buildDownloadCenterVideos(order.videoItems ?? [], {
      accessToken,
      baseUrl: appBase,
    }),
    designs,
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

/** Diseños aprobados del pedido, con sus archivos. Los que están en revisión no se muestran. */
async function loadApprovedDesignsForOrder(orderId: number): Promise<DownloadCenterDesign[]> {
  const projects = await prisma.designProject.findMany({
    where: { albumOrderId: orderId, status: "EXPORTED" },
    orderBy: { id: "asc" },
    select: { id: true, templateV2Id: true, currentRevision: { select: { dataJson: true } } },
  });
  if (projects.length === 0) return [];
  const templateIds = projects.map((p) => p.templateV2Id).filter((id): id is string => id != null);
  const templates = await prisma.templateV2.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(templates.map((t) => [t.id, t.name]));
  const designs: DownloadCenterDesign[] = [];
  for (const p of projects) {
    const data = parseDesignV2Data(p.currentRevision?.dataJson);
    if (!data?.export) continue;
    designs.push({
      id: p.id,
      name: (p.templateV2Id && nameById.get(p.templateV2Id)) || "Tu diseño",
      pdfUrl: data.export.pdfUrl,
      jpgUrls: data.export.jpgUrls,
    });
  }
  return designs;
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
