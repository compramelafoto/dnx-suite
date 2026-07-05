import type { VideoAsset, VideoProcessingStatus } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { VIDEO_CATEGORY_LABELS } from "@/lib/videos/video-validation";

export type VideoAssetDto = {
  id: number;
  albumId: number;
  title: string | null;
  description: string | null;
  category: string;
  categoryLabel: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  orientation: string | null;
  priceCents: number;
  sellEnabled: boolean;
  processingStatus: VideoProcessingStatus;
  processingError: string | null;
  expiresAt: string;
  uploadedAt: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  originalFileName: string | null;
  fileSizeBytes: string | null;
  eventFolderId: number | null;
};

function r2UrlOrNull(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  try {
    return getR2PublicUrl(key);
  } catch {
    return null;
  }
}

export function toVideoAssetDto(video: VideoAsset): VideoAssetDto {
  return {
    id: video.id,
    albumId: video.albumId,
    title: video.title,
    description: video.description,
    category: video.category,
    categoryLabel: VIDEO_CATEGORY_LABELS[video.category],
    durationSeconds: video.durationSeconds,
    width: video.width,
    height: video.height,
    orientation: video.orientation,
    priceCents: video.priceCents,
    sellEnabled: video.sellEnabled,
    processingStatus: video.processingStatus,
    processingError: video.processingError,
    expiresAt: video.expiresAt.toISOString(),
    uploadedAt: video.uploadedAt.toISOString(),
    thumbnailUrl: r2UrlOrNull(video.thumbnailKey),
    previewUrl: r2UrlOrNull(video.previewKey),
    originalFileName: video.originalFileName,
    fileSizeBytes: video.fileSizeBytes != null ? String(video.fileSizeBytes) : null,
    eventFolderId: video.eventFolderId,
  };
}
