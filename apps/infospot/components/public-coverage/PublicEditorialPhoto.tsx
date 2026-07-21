"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProtectedEditorialImage } from "@/components/editorial-photos/protected-editorial-image";
import type { PublicEditorialPhotoViewModel } from "@/lib/public-coverage";
import { EDITORIAL_ZOOM_IMAGE_CLASS } from "@/lib/public-coverage/zoom-image-class";
import { EditorialPhotoCredit } from "./EditorialPhotoCredit";
import { EditorialPhotoUnavailable } from "./EditorialPhotoUnavailable";

type Props = {
  photo: PublicEditorialPhotoViewModel;
  priority?: boolean;
  className?: string;
  /** Si true, permite abrir lightbox vía onOpen (galería). */
  onOpen?: () => void;
};

const displayClass: Record<string, string> = {
  standard: "max-w-2xl mx-auto",
  wide: "w-full",
  full: "w-full max-w-none",
  portrait: "max-w-md mx-auto",
};

function objectPosition(photo: PublicEditorialPhotoViewModel): string | undefined {
  if (photo.usageType !== "COVER") return undefined;
  const x = photo.focalX ?? 0.5;
  const y = photo.focalY ?? 0.5;
  return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
}

/**
 * Render público seguro de foto editorial CLF.
 * Solo acepta view model — sin storage keys ni originales.
 * Zoom: relación de aspecto original (object-contain, sin crop).
 */
export function PublicEditorialPhoto({
  photo,
  priority = false,
  className = "",
  onOpen,
}: Props) {
  const [internalZoom, setInternalZoom] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeZoom = useCallback(() => setInternalZoom(false), []);

  useEffect(() => {
    if (!internalZoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoom();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [internalZoom, closeZoom]);

  if (photo.unavailable || !photo.src) {
    return (
      <EditorialPhotoUnavailable
        caption={photo.caption}
        revoked={photo.revoked}
      />
    );
  }

  const layout = displayClass[photo.displaySize] || displayClass.wide;
  const isCover = photo.usageType === "COVER";
  const ctaHref =
    photo.canShowPurchaseCta
      ? photo.purchaseHref || photo.albumHref
      : null;
  const ctaLabel = ctaHref ? "Comprar fotos" : null;
  const position = objectPosition(photo);

  const handleOpen = onOpen ?? (() => setInternalZoom(true));

  // En página: cover puede croppear; inline respeta aspect. Zoom siempre contain.
  const imgClass = isCover
    ? "h-full w-full object-cover"
    : "h-auto w-full object-contain";

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      srcSet={photo.srcSet || undefined}
      sizes={photo.sizes}
      alt={photo.altText}
      width={photo.widthHint || 960}
      height={
        isCover
          ? Math.round((photo.widthHint || 960) * 0.625)
          : Math.round((photo.widthHint || 960) * 0.66)
      }
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      className={imgClass}
      style={position ? { objectPosition: position } : undefined}
    />
  );

  return (
    <figure
      className={`${layout} ${className}`.trim()}
      data-testid="public-editorial-photo"
      data-photo-id={photo.id}
      data-display={photo.displaySize}
      data-usage={photo.usageType}
    >
      <ProtectedEditorialImage
        photographerName={photo.photographerName}
        credit={photo.credit}
        purchaseHref={photo.canShowPurchaseCta ? photo.purchaseHref : null}
        albumHref={photo.canShowPurchaseCta ? photo.albumHref : null}
      >
        {isCover ? (
          <div className="aspect-[16/10] w-full overflow-hidden bg-[var(--is-bg-muted)]">
            <button
              type="button"
              className="block h-full w-full cursor-zoom-in text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--is-accent)]"
              onClick={handleOpen}
              aria-label={`Ampliar fotografía: ${photo.altText}`}
            >
              {img}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="block w-full cursor-zoom-in text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--is-accent)]"
            onClick={handleOpen}
            aria-label={`Ampliar fotografía: ${photo.altText}`}
          >
            {img}
          </button>
        )}
      </ProtectedEditorialImage>
      <figcaption className="mt-3 space-y-1.5">
        {photo.caption ? (
          <p className="text-sm leading-relaxed text-[var(--is-text-secondary)]">
            {photo.caption}
          </p>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <EditorialPhotoCredit
            credit={photo.credit}
            photographerName={photo.photographerName}
          />
          {ctaHref && photo.canShowPurchaseCta ? (
            <a
              href={ctaHref}
              className="font-semibold text-[var(--is-accent)] hover:underline"
              rel="noopener noreferrer"
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </figcaption>

      {internalZoom ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada: ${photo.altText}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={closeZoom}
          data-testid="editorial-photo-lightbox"
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-5xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              srcSet={photo.srcSet || undefined}
              sizes="(max-width: 1024px) 100vw, 1024px"
              alt={photo.altText}
              className={EDITORIAL_ZOOM_IMAGE_CLASS}
              draggable={false}
            />
            <div className="mt-4 w-full max-w-2xl space-y-2 text-center text-white">
              {photo.caption ? <p className="text-sm">{photo.caption}</p> : null}
              <EditorialPhotoCredit
                credit={photo.credit}
                photographerName={photo.photographerName}
                className="!text-white/80"
              />
              {ctaHref ? (
                <a
                  href={ctaHref}
                  className="inline-block min-h-11 text-sm font-semibold text-[var(--is-orange-300)] hover:underline focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
                  rel="noopener noreferrer"
                >
                  Comprar fotos
                </a>
              ) : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              className="absolute right-0 top-0 min-h-11 min-w-11 rounded bg-white/10 px-3 py-2 text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
              aria-label="Cerrar foto ampliada"
              onClick={closeZoom}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </figure>
  );
}
