"use client";

import type { ReactNode } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import PublicMediaTabs from "./PublicMediaTabs";

type Props = {
  shareSlug: string;
  publicVideosEnabled: boolean;
  initialPublicVideos?: PublicVideoDto[];
  photoCount?: number;
  photosContent: ReactNode;
};

/** Galería colaborativa `/g/[shareSlug]` — solo API de evento. */
export default function PublicEventMediaTabs({
  shareSlug,
  publicVideosEnabled,
  initialPublicVideos = [],
  photoCount = 0,
  photosContent,
}: Props) {
  return (
    <PublicMediaTabs
      source={{ type: "event", shareSlug }}
      publicVideosEnabled={publicVideosEnabled}
      initialPublicVideos={initialPublicVideos}
      photoCount={photoCount}
      defaultTab={photoCount === 0 ? "videos" : "photos"}
      photosContent={photosContent}
    />
  );
}
