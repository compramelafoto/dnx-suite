"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import Button from "@/components/ui/Button";
import {
  aspectClassForOrientation,
  displayVideoTitle,
  formatVideoDuration,
  normalizeVideoOrientation,
  objectFitClassForOrientation,
  orientationLabel,
} from "./public-video-ui";
import {
  logPublicVideoPlayerError,
  openPreviewInNewTab,
  readVideoElementError,
} from "./public-video-player-utils";

type Props = {
  video: PublicVideoDto | null;
  onClose: () => void;
  /** Sin esto el modal es sólo un visor: no muestra precio ni botón de compra. */
  albumId?: number;
  /** El video ya está en el carrito del cliente. */
  inCart?: boolean;
  onAddToCart?: (videoId: number) => void;
  onGoToCheckout?: () => void;
};

const isDev = process.env.NODE_ENV === "development";

export default function PublicVideoPreviewModal({
  video,
  onClose,
  albumId,
  inCart = false,
  onAddToCart,
  onGoToCheckout,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, onClose]);

  useEffect(() => {
    setPlayError(null);
  }, [video?.id, video?.previewUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video?.previewUrl) return;

    const tryPlay = () => {
      void el.play().catch(() => undefined);
    };

    el.addEventListener("loadedmetadata", tryPlay);
    return () => {
      el.removeEventListener("loadedmetadata", tryPlay);
      el.pause();
    };
  }, [video?.id, video?.previewUrl]);

  if (!video) return null;

  const orientation = normalizeVideoOrientation(video.orientation, video.width, video.height);
  const aspect = aspectClassForOrientation(orientation);
  const fit = objectFitClassForOrientation(orientation);
  const isPortrait = orientation === "portrait";
  const hasPreview = Boolean(video.previewUrl?.trim());

  const handleVideoError = () => {
    const el = videoRef.current;
    if (!el) return;
    const info = readVideoElementError(el);
    logPublicVideoPlayerError(video, info);
    setPlayError(info.message);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-video-modal-title"
      onClick={onClose}
    >
      <div
        className={`ds-card relative flex w-full max-h-[92vh] flex-col overflow-hidden bg-[#0f0f0f] shadow-2xl ${
          isPortrait ? "max-w-md" : "max-w-5xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative w-full bg-black ${aspect} max-h-[70vh]`}>
          {hasPreview ? (
            <>
              <video
                ref={videoRef}
                src={video.previewUrl!}
                className={`h-full w-full ${fit}`}
                controls
                playsInline
                muted
                preload="metadata"
                poster={video.thumbnailUrl ?? undefined}
                onError={handleVideoError}
              />
              {playError ? (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3 text-center text-sm text-red-200">
                  {playError}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
              <p className="text-sm">La vista previa aún no está disponible.</p>
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="max-h-[50vh] max-w-full object-contain rounded-lg opacity-90"
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-[#141414] px-4 py-4 sm:px-6 sm:py-5 text-white min-w-0">
          <div className="min-w-0">
            <h2 id="public-video-modal-title" className="text-lg sm:text-xl font-semibold text-white truncate">
              {displayVideoTitle(video)}
            </h2>
            {video.description?.trim() ? (
              <p className="mt-2 text-sm text-white/75 leading-relaxed break-words">{video.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-white/80">
            <span className="rounded-full bg-white/10 px-3 py-1 whitespace-nowrap">
              {video.categoryLabel}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 whitespace-nowrap">
              {formatVideoDuration(video.durationSeconds)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 whitespace-nowrap">
              {orientationLabel(orientation)}
            </span>
          </div>
          {/* El precio ya viene con el fee incluido: es lo que va a pagar. */}
          {video.purchasable && video.priceLabel ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-white/60">Precio del video completo</p>
                <p className="text-2xl font-semibold text-white">{video.priceLabel}</p>
                <p className="mt-1 text-xs text-white/50">
                  Sin marca de agua, en calidad original
                </p>
              </div>
              {albumId && onAddToCart ? (
                inCart ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="whitespace-nowrap text-sm text-emerald-300">
                      ✓ Agregado
                    </span>
                    {onGoToCheckout ? (
                      <Button type="button" onClick={onGoToCheckout} className="whitespace-nowrap">
                        Ir a pagar
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => onAddToCart(video.id)}
                    className="whitespace-nowrap"
                  >
                    Comprar este video
                  </Button>
                )
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {isDev && hasPreview ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => openPreviewInNewTab(video.previewUrl)}
                className="whitespace-nowrap text-xs"
              >
                Abrir preview (dev)
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onClose} className="whitespace-nowrap">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
