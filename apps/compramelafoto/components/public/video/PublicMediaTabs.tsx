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
  /** Habilita la compra de videos. Sin esto la grilla es sólo un visor. */
  albumId?: number;
};

export default function PublicMediaTabs({
  source,
  publicVideosEnabled,
  initialPublicVideos = [],
  photosContent,
  accentColor,
  defaultTab = "photos",
  photoCount = 0,
  albumId,
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
          albumId={albumId}
        />
      )}
    </section>
  );

  if (videosOnlyMode) {
    return videosSection;
  }

  /**
   * Pestañas grandes y con ícono, no dos píldoras de texto.
   *
   * El cliente tiene que entender de un vistazo que son dos carpetas distintas
   * —las fotos y los videos— y en cuál está parado. Antes eran dos píldoras
   * chicas casi iguales y la gente no registraba el cambio.
   */
  const tabBtnClass = (active: boolean) =>
    `flex min-h-[60px] flex-1 items-center justify-center gap-2.5 rounded-xl border-2 px-5 py-3 text-base font-semibold transition sm:flex-none sm:px-7 ${
      active
        ? "border-[#1a1a1a] bg-[#1a1a1a] text-white shadow-md"
        : "border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#cbd5e1] hover:text-[#1a1a1a]"
    }`;

  const contadorClass = (active: boolean) =>
    `rounded-full px-2 py-0.5 text-xs font-bold ${
      active ? "bg-white/20 text-white" : "bg-[#f3f4f6] text-[#6b7280]"
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
          <button
            type="button"
            data-media-tab="photos"
            className={tabBtnClass(tab === "photos")}
            onClick={() => setTab("photos")}
          >
            <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            <span>Fotos</span>
            <span className={contadorClass(tab === "photos")}>{photoCount}</span>
          </button>
        ) : null}
        {/* data-media-tab lo usa la búsqueda por selfie para traer al cliente
            hasta acá cuando encuentra un video suyo. */}
        <button
          type="button"
          data-media-tab="videos"
          className={tabBtnClass(tab === "videos")}
          onClick={() => setTab("videos")}
        >
          <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h8.25a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span>Videos</span>
          <span className={contadorClass(tab === "videos")}>{videos.length}</span>
        </button>
      </nav>

      {tab === "photos" ? photosContent : videosSection}
    </div>
  );
}
