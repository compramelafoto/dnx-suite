"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { PublicEditorialPhotoViewModel } from "@/lib/public-coverage";
import { PublicEditorialPhoto } from "./PublicEditorialPhoto";
import { EditorialPhotoCredit } from "./EditorialPhotoCredit";

type Props = {
  photos: PublicEditorialPhotoViewModel[];
  albumHref?: string | null;
  albumCtaLabel?: string;
  initialLimit?: number;
};

/**
 * Galería pública GALLERY: orden manual, multi-autor, lightbox editorial.
 * Solo derivados; nunca original CLF.
 */
export function PublicEditorialGallery({
  photos,
  albumHref,
  albumCtaLabel = "Ver álbum completo",
  initialLimit = 12,
}: Props) {
  const titleId = useId();
  const ordered = [...photos].sort((a, b) => a.sortOrder - b.sortOrder);
  const [limit, setLimit] = useState(initialLimit);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visible = ordered.slice(0, limit);
  const hasMore = ordered.length > limit;

  const close = useCallback(() => setLightboxIndex(null), []);
  const go = useCallback(
    (delta: number) => {
      setLightboxIndex((idx) => {
        if (idx == null) return idx;
        const next = idx + delta;
        if (next < 0 || next >= ordered.length) return idx;
        return next;
      });
    },
    [ordered.length],
  );

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, close, go]);

  if (ordered.length === 0) return null;

  const active = lightboxIndex != null ? ordered[lightboxIndex] : null;

  return (
    <section className="mt-14" aria-labelledby={titleId} data-testid="public-editorial-gallery">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id={titleId} className="is-title-section text-2xl">
          Galería
        </h2>
        {albumHref ? (
          <a
            href={albumHref}
            className="text-sm font-medium text-[var(--is-accent)] hover:underline"
            rel="noopener noreferrer"
          >
            {albumCtaLabel}
          </a>
        ) : null}
      </div>

      <ul className="mt-6 grid gap-6 sm:grid-cols-2">
        {visible.map((photo, i) => (
          <li key={`${photo.id}-${photo.sortOrder}`}>
            <PublicEditorialPhoto
              photo={photo}
              onOpen={photo.src ? () => setLightboxIndex(i) : undefined}
            />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="is-btn is-btn-ghost min-h-11"
            onClick={() => setLimit((n) => n + initialLimit)}
          >
            Ver más fotos
          </button>
        </div>
      ) : null}

      {active && active.src ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada: ${active.altText}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={close}
          data-testid="editorial-gallery-lightbox"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.src}
              srcSet={active.srcSet || undefined}
              sizes="(max-width: 1024px) 100vw, 1024px"
              alt={active.altText}
              className="max-h-[75vh] w-full object-contain"
              draggable={false}
            />
            <div className="mt-4 space-y-2 text-white">
              {active.caption ? <p className="text-sm">{active.caption}</p> : null}
              <EditorialPhotoCredit
                credit={active.credit}
                photographerName={active.photographerName}
                className="!text-white/80"
              />
              {active.canShowPurchaseCta &&
              (active.purchaseHref || active.albumHref) ? (
                <a
                  href={
                    active.hasSpecificPurchaseUrl
                      ? active.purchaseHref || "#"
                      : active.albumHref || "#"
                  }
                  className="inline-block text-sm font-semibold text-[var(--is-orange-300)] hover:underline"
                  rel="noopener noreferrer"
                >
                  {active.hasSpecificPurchaseUrl
                    ? "Ver y comprar esta foto"
                    : "Buscar esta foto en el álbum"}
                </a>
              ) : null}
            </div>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <button
                type="button"
                className="rounded bg-white/10 px-3 py-2 text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
                aria-label="Foto anterior"
                onClick={() => go(-1)}
                disabled={lightboxIndex === 0}
              >
                ‹
              </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button
                type="button"
                className="rounded bg-white/10 px-3 py-2 text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
                aria-label="Foto siguiente"
                onClick={() => go(1)}
                disabled={lightboxIndex === ordered.length - 1}
              >
                ›
              </button>
            </div>
            <button
              type="button"
              className="absolute right-0 top-0 rounded bg-white/10 px-3 py-2 text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
              aria-label="Cerrar"
              onClick={close}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
