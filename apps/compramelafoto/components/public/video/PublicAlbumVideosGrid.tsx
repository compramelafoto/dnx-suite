"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import type { PublicEventVideoDto } from "@/lib/videos/public-event-videos";
import PublicVideoPreviewModal from "./PublicVideoPreviewModal";
import VideoRemovalModal from "./VideoRemovalModal";
import {
  addToVideoCart,
  notifyVideoCartChanged,
  readVideoCart,
  removeFromVideoCart,
} from "@/lib/videos/video-cart-storage";
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
  /** Sin álbum la grilla es sólo un visor, sin compra (por ejemplo en eventos). */
  albumId?: number;
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
  /** Abre el visor ampliado. Es la lupa, igual que en las fotos. */
  onOpen: () => void;
  /** Elegir o sacar el video del carrito. */
  onToggleSelect?: () => void;
  selected?: boolean;
  /** Pedir que lo saquen de circulación (derecho de imagen). */
  onRequestRemoval?: () => void;
};

function PublicVideoCard({
  video,
  isHovering,
  showEventAlbumContext,
  onHoverStart,
  onHoverEnd,
  onOpen,
  onToggleSelect,
  selected = false,
  onRequestRemoval,
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
      className={`${spanClass} group ds-card relative overflow-hidden border border-[#e5e7eb] bg-white shadow-sm transition-shadow hover:shadow-md ${
        selected ? "ring-2 ring-[#c27b3d] ring-offset-2" : ""
      }`}
    >
      {/* Elegido: mismo cartel y mismo color que en las fotos. */}
      {selected && onToggleSelect ? (
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1.5 rounded-full bg-[#c27b3d] px-2.5 py-1 text-xs font-medium text-white shadow">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Seleccionado
        </div>
      ) : null}

      {/* La lupa azul: idéntica a la de las fotos, para ver ampliado. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="absolute right-2 top-2 z-20 rounded-full bg-[#2563eb] p-2 text-white shadow transition-colors hover:bg-[#1d4ed8]"
        aria-label="Ver el video ampliado, con marca de agua"
        title="Ver ampliado (con marca de agua)"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
        </svg>
      </button>

      {/* Pedir la baja: mismo botón amarillo que en las fotos. Acá saca el
          video ENTERO, porque no se puede recortar a alguien de una escena. */}
      {onRequestRemoval ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestRemoval();
          }}
          className="absolute bottom-1.5 right-1.5 z-20 rounded-full bg-yellow-500 p-1.5 text-white opacity-0 shadow-md transition-opacity hover:bg-yellow-600 group-hover:opacity-100"
          aria-label="Pedir que den de baja este video"
          title="Pedir que den de baja este video"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        onClick={onToggleSelect ?? onOpen}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        aria-label={
          onToggleSelect
            ? `${selected ? "Sacar" : "Elegir"} ${displayVideoTitle(video)}`
            : `Reproducir ${displayVideoTitle(video)}`
        }
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
            {/* El precio se ve acá, en la grilla. Antes había que entrar al
                visor para saber cuánto costaba. */}
            {video.purchasable && video.priceLabel ? (
              <p className="mt-1 text-base font-bold text-white">{video.priceLabel}</p>
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
  albumId,
}: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [modalVideo, setModalVideo] = useState<PublicVideoDto | null>(null);
  const [cart, setCart] = useState<number[]>([]);
  const [removalVideo, setRemovalVideo] = useState<PublicVideoDto | null>(null);

  // El carrito vive en sessionStorage, al lado del de fotos: lo que el cliente
  // elige sobrevive hasta el resumen y se paga todo junto.
  useEffect(() => {
    if (albumId) setCart(readVideoCart(albumId));
  }, [albumId]);

  const handleAddToCart = useCallback(
    (videoId: number) => {
      if (!albumId) return;
      setCart(addToVideoCart(albumId, videoId));
    },
    [albumId]
  );

  /** Un clic elige, otro saca: igual que tocar una foto. */
  const handleToggleSelect = useCallback(
    (videoId: number) => {
      if (!albumId) return;
      setCart((actual) => {
        const siguiente = actual.includes(videoId)
          ? removeFromVideoCart(albumId, videoId)
          : addToVideoCart(albumId, videoId);
        // El botón de comprar vive en otro componente y tiene que enterarse:
        // es el mismo botón para fotos y videos.
        notifyVideoCartChanged(albumId, siguiente);
        return siguiente;
      });
    },
    [albumId]
  );

  const handleGoToCheckout = useCallback(() => {
    if (!albumId) return;
    window.location.href = `/a/${albumId}/comprar/resumen`;
  }, [albumId]);

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
            selected={cart.includes(video.id)}
            onToggleSelect={
              albumId && video.purchasable
                ? () => handleToggleSelect(video.id)
                : undefined
            }
            onRequestRemoval={
              albumId ? () => setRemovalVideo(video) : undefined
            }
          />
        ))}
      </div>
      {albumId ? (
        <VideoRemovalModal
          video={removalVideo}
          albumId={albumId}
          onClose={() => setRemovalVideo(null)}
        />
      ) : null}

      <PublicVideoPreviewModal
        video={modalVideo}
        onClose={() => setModalVideo(null)}
        albumId={albumId}
        inCart={modalVideo ? cart.includes(modalVideo.id) : false}
        onAddToCart={handleAddToCart}
        onGoToCheckout={handleGoToCheckout}
      />
    </>
  );
}
