import type { PrismaClient, VideoCategory } from "@/lib/prisma";
import { isAlbumComplete, isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { toPublicVideoDto, type PublicVideoDto } from "@/lib/videos/public-video-dto";
import { publicReadyVideoBaseWhere } from "@/lib/videos/public-ready-videos";
import {
  buildPublicVideoListDiagnostics,
  devDiagnosticsPayload,
  logPublicVideoListDiagnostics,
  type PublicVideoListDiagnostics,
} from "@/lib/videos/public-video-list-diagnostics";

/** Mismo criterio de álbum que la grilla de fotos en `/g/[shareSlug]`. */
export type EventAlbumForPublicVideos = {
  id: number;
  title: string | null;
  publicSlug: string | null;
  isPublic: boolean | null;
  isHidden: boolean | null;
  enablePrintedPhotos: boolean | null;
  enableDigitalPhotos: boolean | null;
  selectedLabId: number | null;
  albumProfitMarginPercent: number | null;
  pickupBy: string | null;
  digitalPhotoPriceCents: number | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  user: { name: string | null } | null;
};

export function filterEventAlbumsForPublicGallery(
  albums: EventAlbumForPublicVideos[]
): EventAlbumForPublicVideos[] {
  return albums.filter((a) => isAlbumPubliclyAccessible(a) && isAlbumComplete(a));
}

export type PublicEventVideoDto = PublicVideoDto & {
  albumId: number;
  albumTitle: string | null;
  /** Alias de albumTitle para UI colaborativa */
  albumName: string | null;
  albumPublicSlug: string | null;
  photographerName: string | null;
};

const eventVideoSelect = {
  id: true,
  albumId: true,
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

export type PublicEventVideoListResult = {
  videos: PublicEventVideoDto[];
  devDiagnostics: PublicVideoListDiagnostics | null;
};

/**
 * Videos READY de todos los álbumes públicos del evento (misma visibilidad que fotos).
 */
export async function listPublicReadyVideosForEvent(
  prisma: PrismaClient,
  eventId: number,
  options?: { applyExpiresFilter?: boolean }
): Promise<PublicEventVideoListResult> {
  if (!isVideoMvpEnabled()) {
    return { videos: [], devDiagnostics: null };
  }

  const applyExpiresFilter = options?.applyExpiresFilter ?? true;

  const albums = await prisma.album.findMany({
    where: {
      eventId,
      deletedAt: null,
      isHidden: false,
    },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      isPublic: true,
      isHidden: true,
      enablePrintedPhotos: true,
      enableDigitalPhotos: true,
      selectedLabId: true,
      albumProfitMarginPercent: true,
      pickupBy: true,
      digitalPhotoPriceCents: true,
      termsAcceptedAt: true,
      termsVersion: true,
      user: { select: { name: true } },
    },
  });

  const eligible = filterEventAlbumsForPublicGallery(albums);
  const eligibleIds = eligible.map((a) => a.id);

  if (eligible.length === 0) {
    const emptyDiagnostics = buildPublicVideoListDiagnostics([], new Set(), {
      scope: "event",
      scopeId: eventId,
      applyExpiresFilter,
      eventAlbums: {
        total: albums.length,
        eligible: 0,
        excluded: albums.length,
        excludedAlbumIds: albums.map((a) => a.id),
      },
    });
    logPublicVideoListDiagnostics(emptyDiagnostics);
    return {
      videos: [],
      devDiagnostics: devDiagnosticsPayload(emptyDiagnostics) ?? null,
    };
  }

  const metaByAlbumId = new Map(
    eligible.map((a) => [
      a.id,
      {
        title: a.title,
        publicSlug: a.publicSlug,
        photographerName: a.user?.name ?? null,
      },
    ])
  );

  const allInEvent = await prisma.videoAsset.findMany({
    where: { albumId: { in: eligibleIds } },
    select: eventVideoSelect,
  });

  const now = new Date();
  const filtered = await prisma.videoAsset.findMany({
    where: {
      albumId: { in: eligibleIds },
      ...publicReadyVideoBaseWhere,
      ...(applyExpiresFilter ? { expiresAt: { gt: now } } : {}),
    },
    orderBy: { uploadedAt: "desc" },
    select: eventVideoSelect,
  });

  const returnedIds = new Set(filtered.map((v) => v.id));
  const diagnostics = buildPublicVideoListDiagnostics(allInEvent, returnedIds, {
    scope: "event",
    scopeId: eventId,
    applyExpiresFilter,
    eventAlbums: {
      total: albums.length,
      eligible: eligible.length,
      excluded: albums.length - eligible.length,
      excludedAlbumIds: albums.filter((a) => !eligibleIds.includes(a.id)).map((a) => a.id),
    },
  });
  logPublicVideoListDiagnostics(diagnostics);

  const videos = filtered.map((v) => {
    const meta = metaByAlbumId.get(v.albumId);
    const albumTitle = meta?.title ?? null;
    return {
      ...toPublicVideoDto(v as typeof v & { category: VideoCategory }),
      albumId: v.albumId,
      albumTitle,
      albumName: albumTitle,
      albumPublicSlug: meta?.publicSlug ?? null,
      photographerName: meta?.photographerName ?? null,
    };
  });

  return {
    videos,
    devDiagnostics: devDiagnosticsPayload(diagnostics) ?? null,
  };
}
