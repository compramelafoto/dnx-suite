"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import {
  fetchPublicVideos,
  type PublicVideoSource,
} from "@/lib/videos/public-video-source";
import PublicAlbumVideosGrid from "./PublicAlbumVideosGrid";

type MediaTab = "photos" | "videos";

type Props = {
  source: PublicVideoSource;
  publicVideosEnabled: boolean;
  /** Precargados en servidor (evita depender solo del fetch cliente). */
  initialPublicVideos?: PublicVideoDto[];
  photosContent: ReactNode;
  accentColor?: string;
  defaultTab?: MediaTab;
  photoCount?: number;
};

export default function PublicMediaTabs({
  source,
  publicVideosEnabled,
  initialPublicVideos = [],
  photosContent,
  accentColor,
  defaultTab = "photos",
  photoCount = 0,
}: Props) {
  const preferVideosOnly =
    photoCount === 0 &&
    (initialPublicVideos.length > 0 || defaultTab === "videos");

  const resolvedDefaultTab: MediaTab = preferVideosOnly ? "videos" : defaultTab;

  const [tab, setTab] = useState<MediaTab>(resolvedDefaultTab);
  const [videos, setVideos] = useState<PublicVideoDto[]>(initialPublicVideos);
  const [showEventAlbumContext, setShowEventAlbumContext] = useState(
    source.type === "event"
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sourceKey =
    source.type === "event"
      ? `event:${source.shareSlug.trim()}`
      : `album:${source.slug.trim()}`;

  useEffect(() => {
    if (!publicVideosEnabled) {
      setVideos([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchPublicVideos(source)
      .then((result) => {
        if (cancelled) return;
        setVideos((prev) => {
          if (result.videos.length > 0) return result.videos;
          if (result.loadError && prev.length > 0) return prev;
          return result.videos;
        });
        setShowEventAlbumContext(result.showEventAlbumContext);
        setLoadError(result.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicVideosEnabled, sourceKey]);

  useEffect(() => {
    setVideos(initialPublicVideos);
  }, [sourceKey]);

  const showVideosTab = publicVideosEnabled && videos.length > 0;

  useEffect(() => {
    if (!showVideosTab && tab === "videos") {
      setTab("photos");
    }
  }, [showVideosTab, tab]);

  useEffect(() => {
    if (showVideosTab && photoCount === 0) {
      setTab("videos");
    }
  }, [showVideosTab, photoCount]);

  if (!showVideosTab) {
    if (photoCount === 0 && publicVideosEnabled && loading) {
      return (
        <p
          className={`text-sm py-12 text-center ${
            source.type === "event" ? "text-gray-500" : "text-[#6b7280]"
          }`}
        >
          Cargando videos…
        </p>
      );
    }
    return <>{photosContent}</>;
  }

  const videosOnlyMode = photoCount === 0;
  const videosAriaLabel =
    source.type === "event" ? "Videos del evento" : "Videos del álbum";

  const videosSection = (
    <section className="w-full min-w-0" aria-label={videosAriaLabel}>
      {loading ? (
        <p
          className={`text-sm py-12 text-center ${
            source.type === "event" ? "text-gray-500" : "text-[#6b7280]"
          }`}
        >
          Cargando videos…
        </p>
      ) : loadError ? (
        <p className="text-sm text-[#6b7280] py-12 text-center">{loadError}</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-[#6b7280] py-12 text-center">
          No hay videos disponibles en este momento.
        </p>
      ) : (
        <PublicAlbumVideosGrid
          videos={videos}
          accentColor={accentColor}
          showEventAlbumContext={showEventAlbumContext}
        />
      )}
    </section>
  );

  if (videosOnlyMode) {
    return videosSection;
  }

  const tabBtnClass = (active: boolean) =>
    source.type === "event"
      ? `min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-full transition whitespace-nowrap ${
          active
            ? "bg-gray-900 text-white shadow-sm"
            : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
        }`
      : `min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-full transition whitespace-nowrap ${
          active
            ? "bg-[#1a1a1a] text-white shadow-sm"
            : "bg-white text-[#4b5563] border border-[#e5e7eb] hover:border-[#cbd5e1] hover:text-[#1a1a1a]"
        }`;

  return (
    <div className="w-full min-w-0">
      <nav
        className="mb-6 flex flex-wrap items-center gap-2"
        aria-label={
          source.type === "event" ? "Contenido de la galería" : "Contenido del álbum"
        }
      >
        {photoCount > 0 ? (
          <button type="button" className={tabBtnClass(tab === "photos")} onClick={() => setTab("photos")}>
            Fotos
          </button>
        ) : null}
        <button type="button" className={tabBtnClass(tab === "videos")} onClick={() => setTab("videos")}>
          Videos
          <span className="ml-1.5 text-xs font-normal opacity-80">({videos.length})</span>
        </button>
      </nav>

      {tab === "photos" ? photosContent : videosSection}
    </div>
  );
}
