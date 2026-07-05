import type { Prisma, PrismaClient, VideoCategory } from "@/lib/prisma";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { toPublicVideoDto, type PublicVideoDto } from "@/lib/videos/public-video-dto";
import {
  buildPublicVideoListDiagnostics,
  devDiagnosticsPayload,
  logPublicVideoListDiagnostics,
  type PublicVideoListDiagnostics,
} from "@/lib/videos/public-video-list-diagnostics";

/** READY y no removidos — sin exigir preview/thumbnail ni sellEnabled (MVP galería). */
export const publicReadyVideoBaseWhere: Prisma.VideoAssetWhereInput = {
  isRemoved: false,
  processingStatus: "READY",
};

/** @deprecated Usar publicReadyVideoBaseWhere; mantener alias por compatibilidad interna. */
export const publicReadyVideoWhere: Prisma.VideoAssetWhereInput = {
  ...publicReadyVideoBaseWhere,
};

const publicReadyVideoSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  durationSeconds: true,
  orientation: true,
  thumbnailKey: true,
  previewKey: true,
  width: true,
  height: true,
  uploadedAt: true,
  sellEnabled: true,
  expiresAt: true,
  processingStatus: true,
  isRemoved: true,
} as const;

export type PublicVideoListResult = {
  videos: PublicVideoDto[];
  devDiagnostics: PublicVideoListDiagnostics | null;
};

function buildListWhere(
  albumId: number,
  applyExpiresFilter: boolean
): Prisma.VideoAssetWhereInput {
  const now = new Date();
  return {
    albumId,
    ...publicReadyVideoBaseWhere,
    ...(applyExpiresFilter ? { expiresAt: { gt: now } } : {}),
  };
}

export async function countPublicReadyVideos(
  prisma: PrismaClient,
  albumId: number
): Promise<number> {
  if (!isVideoMvpEnabled()) return 0;
  return prisma.videoAsset.count({
    where: { albumId, ...publicReadyVideoBaseWhere },
  });
}

export async function albumHasPublicReadyVideos(
  prisma: PrismaClient,
  albumId: number
): Promise<boolean> {
  return (await countPublicReadyVideos(prisma, albumId)) > 0;
}

/** Lista DTO público por álbum (sin originalKey; el caller valida acceso al álbum). */
export async function listPublicReadyVideosForAlbum(
  prisma: PrismaClient,
  albumId: number,
  options?: { applyExpiresFilter?: boolean }
): Promise<PublicVideoListResult> {
  if (!isVideoMvpEnabled()) {
    return { videos: [], devDiagnostics: null };
  }

  const applyExpiresFilter = options?.applyExpiresFilter ?? false;

  const allInAlbum = await prisma.videoAsset.findMany({
    where: { albumId },
    select: publicReadyVideoSelect,
  });

  const where = buildListWhere(albumId, applyExpiresFilter);
  const filtered = await prisma.videoAsset.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    select: publicReadyVideoSelect,
  });

  const returnedIds = new Set(filtered.map((v) => v.id));
  const diagnostics = buildPublicVideoListDiagnostics(allInAlbum, returnedIds, {
    scope: "album",
    scopeId: albumId,
    applyExpiresFilter,
  });
  logPublicVideoListDiagnostics(diagnostics);

  const videos = filtered.map((v) =>
    toPublicVideoDto(v as typeof v & { category: VideoCategory })
  );

  return {
    videos,
    devDiagnostics: devDiagnosticsPayload(diagnostics) ?? null,
  };
}
