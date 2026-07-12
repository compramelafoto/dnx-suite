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
  const ctaHref =
    photo.canShowPurchaseCta
      ? photo.hasSpecificPurchaseUrl
        ? photo.purchaseHref
        : photo.albumHref
      : null;
  const ctaLabel = !ctaHref
    ? null
    : photo.hasSpecificPurchaseUrl
      ? "Ver y comprar esta foto"
      : "Buscar esta foto en el álbum";

  return (
    <figure
      className={`${layout} ${className}`.trim()}
      data-testid="public-editorial-photo"
      data-photo-id={photo.id}
      data-display={photo.displaySize}
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
        {onOpen ? (
          <button
            type="button"
            className="block w-full cursor-zoom-in text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--is-accent)]"
            onClick={onOpen}
            aria-label={`Ampliar fotografía: ${photo.altText}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              srcSet={photo.srcSet || undefined}
              sizes={photo.sizes}
              alt={photo.altText}
              width={photo.widthHint || 960}
              height={Math.round((photo.widthHint || 960) * 0.66)}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              draggable={false}
              className="w-full object-cover"
            />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            srcSet={photo.srcSet || undefined}
            sizes={photo.sizes}
            alt={photo.altText}
            width={photo.widthHint || 960}
            height={Math.round((photo.widthHint || 960) * 0.66)}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            draggable={false}
            className="w-full object-cover"
          />
        )}
      </ProtectedEditorialImage>
      <figcaption className="mt-3 space-y-1">
        {photo.caption ? (
          <p className="text-sm text-[var(--is-text-secondary)]">{photo.caption}</p>
        ) : null}
        <EditorialPhotoCredit
          credit={photo.credit}
          photographerName={photo.photographerName}
        />
        {ctaHref && photo.canShowPurchaseCta ? (
          <p className="pt-1">
            <a
              href={ctaHref}
              className="text-sm font-medium text-[var(--is-accent)] hover:underline"
              rel="noopener noreferrer"
            >
              {ctaLabel}
            </a>
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
