import type { VideoCategory } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { VIDEO_CATEGORY_LABELS } from "@/lib/videos/video-validation";

/** Campos mínimos para mapear a DTO público (sin originalKey ni precios). */
export type PublicVideoRow = {
  id: number;
  title: string | null;
  description: string | null;
  category: VideoCategory;
  durationSeconds: number | null;
  orientation: string | null;
  thumbnailKey: string | null;
  previewKey: string | null;
  width: number | null;
  height: number | null;
  uploadedAt: Date;
};

export type PublicVideoDto = {
  id: number;
  title: string | null;
  description: string | null;
  category: string;
  categoryLabel: string;
  durationSeconds: number | null;
  orientation: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

function r2UrlOrNull(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  try {
    return getR2PublicUrl(key);
  } catch {
    return null;
  }
}

export function toPublicVideoDto(video: PublicVideoRow): PublicVideoDto {
  const thumbnailUrl = r2UrlOrNull(video.thumbnailKey);
  const previewUrl = r2UrlOrNull(video.previewKey);

  if (process.env.NODE_ENV === "development") {
    if (video.previewKey?.trim() && !previewUrl) {
      console.warn("[public-video-dto] previewKey sin URL pública", {
        id: video.id,
        previewKey: video.previewKey,
      });
    }
    if (video.thumbnailKey?.trim() && !thumbnailUrl) {
      console.warn("[public-video-dto] thumbnailKey sin URL pública", {
        id: video.id,
        thumbnailKey: video.thumbnailKey,
      });
    }
  }

  return {
    id: video.id,
    title: video.title,
    description: video.description,
    category: video.category,
    categoryLabel: VIDEO_CATEGORY_LABELS[video.category],
    durationSeconds: video.durationSeconds,
    orientation: video.orientation,
    thumbnailUrl,
    previewUrl,
    width: video.width,
    height: video.height,
    createdAt: video.uploadedAt.toISOString(),
  };
}
