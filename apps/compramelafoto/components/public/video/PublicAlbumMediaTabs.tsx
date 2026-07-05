"use client";

import type { ReactNode } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import PublicMediaTabs from "./PublicMediaTabs";

type Props = {
  publicSlug: string | null | undefined;
  publicVideosEnabled: boolean;
  initialPublicVideos?: PublicVideoDto[];
  photosContent: ReactNode;
  accentColor?: string;
  defaultTab?: "photos" | "videos";
  photoCount?: number;
};

/** Galería de álbum `/album/[slug]` — solo API de álbum. */
export default function PublicAlbumMediaTabs({
  publicSlug,
  publicVideosEnabled,
  initialPublicVideos = [],
  photosContent,
  accentColor,
  defaultTab = "photos",
  photoCount = 0,
}: Props) {
  if (!publicSlug?.trim()) {
    return <>{photosContent}</>;
  }

  return (
    <PublicMediaTabs
      source={{ type: "album", slug: publicSlug.trim() }}
      publicVideosEnabled={publicVideosEnabled}
      initialPublicVideos={initialPublicVideos}
      photoCount={photoCount}
      photosContent={photosContent}
      accentColor={accentColor}
      defaultTab={photoCount === 0 ? "videos" : defaultTab}
    />
  );
}
