"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import type { PublicEventVideoDto } from "@/lib/videos/public-event-videos";
import PublicVideoPreviewModal from "./PublicVideoPreviewModal";
import {
  aspectClassForOrientation,
  devLogPublicVideoCard,
  displayVideoTitle,
  formatVideoDuration,
  normalizeVideoOrientation,
  objectFitClassForOrientation,
  orientationLabel,
} from "./public-video-ui";
import { logPublicVideoPlayerError, readVideoElementError } from "./public-video-player-utils";
import { GalleryMediaTypeBadgeSingle } from "@/components/gallery/GalleryMediaTypeBadges";

function eventAlbumContextLine(video: PublicVideoDto): string | null {
  const ev = video as PublicEventVideoDto;
  if (!ev.albumName && !ev.albumTitle && !ev.photographerName) return null;
  const album = ev.albumName ?? ev.albumTitle;
  if (album && ev.photographerName) return `${album} · ${ev.photographerName}`;
  return album ?? ev.photographerName ?? null;
}

type Props = {
  videos: PublicVideoDto[];
  accentColor?: string;
  showEventAlbumContext?: boolean;
};

function VideoThumbnailPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white/70">
      <svg
        className="h-10 w-10 sm:h-12 sm:w-12 opacity-80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <span className="text-xs font-medium tracking-wide">Vista previa</span>
    </div>
  );
}

type VideoCardProps = {
  video: PublicVideoDto;
  isHovering: boolean;
  showEventAlbumContext?: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onOpen: () => void;
};

function PublicVideoCard({
  video,
  isHovering,
  showEventAlbumContext,
  onHoverStart,
  onHoverEnd,
  onOpen,
}: VideoCardProps) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const [hoverPlayFailed, setHoverPlayFailed] = useState(false);
  const orientation = normalizeVideoOrientation(video.orientation, video.width, video.height);
  const aspect = aspectClassForOrientation(orientation);
  const fit = objectFitClassForOrientation(orientation);
  const spanClass =
    orientation === "portrait"
      ? "col-span-1 sm:col-span-1 md:max-w-[280px] md:justify-self-center"
      : orientation === "square"
        ? "col-span-1 sm:col-span-1"
        : "col-span-1 sm:col-span-2";

  const previewUrl = video.previewUrl?.trim() || null;
  const canHoverPreview = Boolean(previewUrl);
  const showPreviewLayer = isHovering && canHoverPreview;

  useEffect(() => {
    devLogPublicVideoCard(video, orientation);
  }, [video.id, video.previewUrl, video.thumbnailUrl, orientation]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !previewUrl) return;

    if (showPreviewLayer) {
      setHoverPlayFailed(false);
      if (el.src !== previewUrl) {
        el.src = previewUrl;
      }
      el.load();
      void el.play().catch(() => {
        setHoverPlayFailed(true);
      });
    } else {
      setHoverPlayFailed(false);
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [showPreviewLayer, previewUrl]);

  const handleHoverVideoError = () => {
    const el = previewRef.current;
    if (!el) return;
    const info = readVideoElementError(el);
    logPublicVideoPlayerError(video, info);
    setHoverPlayFailed(true);
  };

  const eventContext = showEventAlbumContext ? eventAlbumContextLine(video) : null;

  return (
    <article
      className={`${spanClass} group ds-card overflow-hidden border border-[#e5e7eb] bg-white shadow-sm transition-shadow hover:shadow-md`}
    >
      <button
        type="button"
        className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        onClick={onOpen}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        aria-label={`Reproducir ${displayVideoTitle(video)}`}
      >
        <div className={`relative w-full overflow-hidden bg-[#0a0a0a] ${aspect}`}>
          <GalleryMediaTypeBadgeSingle type="video" />
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-200 ${
                showPreviewLayer ? "opacity-0" : "opacity-100"
              }`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <VideoThumbnailPlaceholder />
          )}

          {canHoverPreview ? (
            <video
              ref={previewRef}
              className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-200 ${
                showPreviewLayer && !hoverPlayFailed ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              muted
              loop
              playsInline
              preload="none"
              poster={video.thumbnailUrl ?? undefined}
              onError={handleHoverVideoError}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90" />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm">
              {orientationLabel(orientation)}
            </span>
            {video.durationSeconds != null ? (
              <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                {formatVideoDuration(video.durationSeconds)}
              </span>
            ) : null}
          </div>

          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity ${
              showPreviewLayer ? "opacity-0" : "opacity-100 group-hover:opacity-90"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
              <svg className="h-6 w-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3 sm:p-4 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/70 truncate">
              {video.categoryLabel}
            </p>
            <h3 className="text-sm sm:text-base font-semibold text-white truncate">
              {displayVideoTitle(video)}
            </h3>
            {eventContext ? (
              <p className="text-[10px] text-white/65 truncate mt-0.5">{eventContext}</p>
            ) : null}
          </div>
        </div>
      </button>
    </article>
  );
}

export default function PublicAlbumVideosGrid({
  videos,
  showEventAlbumContext = false,
}: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [modalVideo, setModalVideo] = useState<PublicVideoDto | null>(null);

  const handleHoverStart = useCallback((id: number) => {
    setHoveredId(id);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setHoveredId(null);
  }, []);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-[#6b7280] py-8 text-center">
        No hay videos disponibles en este álbum.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
        {videos.map((video) => (
          <PublicVideoCard
            key={video.id}
            video={video}
            isHovering={hoveredId === video.id}
            showEventAlbumContext={showEventAlbumContext}
            onHoverStart={() => handleHoverStart(video.id)}
            onHoverEnd={handleHoverEnd}
            onOpen={() => setModalVideo(video)}
          />
        ))}
      </div>
      <PublicVideoPreviewModal video={modalVideo} onClose={() => setModalVideo(null)} />
    </>
  );
}
