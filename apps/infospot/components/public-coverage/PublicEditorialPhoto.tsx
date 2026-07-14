"use client";

import { ProtectedEditorialImage } from "@/components/editorial-photos/protected-editorial-image";
import type { PublicEditorialPhotoViewModel } from "@/lib/public-coverage";
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
 */
export function PublicEditorialPhoto({
  photo,
  priority = false,
  className = "",
  onOpen,
}: Props) {
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
      ? photo.hasSpecificPurchaseUrl
        ? photo.purchaseHref
        : photo.albumHref
      : null;
  const ctaLabel = ctaHref ? "Comprar Fotos" : null;
  const position = objectPosition(photo);

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
        purchaseHref={
          photo.canShowPurchaseCta && photo.hasSpecificPurchaseUrl
            ? photo.purchaseHref
            : null
        }
        albumHref={photo.canShowPurchaseCta ? photo.albumHref : null}
      >
        {isCover ? (
          <div className="aspect-[16/10] w-full overflow-hidden bg-[var(--is-bg-muted)]">
            {onOpen ? (
              <button
                type="button"
                className="block h-full w-full cursor-zoom-in text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--is-accent)]"
                onClick={onOpen}
                aria-label={`Ampliar fotografía: ${photo.altText}`}
              >
                {img}
              </button>
            ) : (
              img
            )}
          </div>
        ) : onOpen ? (
          <button
            type="button"
            className="block w-full cursor-zoom-in text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--is-accent)]"
            onClick={onOpen}
            aria-label={`Ampliar fotografía: ${photo.altText}`}
          >
            {img}
          </button>
        ) : (
          img
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
    </figure>
  );
}
