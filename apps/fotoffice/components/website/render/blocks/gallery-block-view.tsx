"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryBlockConfig, GalleryPhoto } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";

const COLUMNS_CLASS: Record<GalleryBlockConfig["columns"], { grid: string; masonry: string }> = {
  2: { grid: "grid-cols-1 sm:grid-cols-2", masonry: "columns-1 sm:columns-2" },
  3: { grid: "grid-cols-2 md:grid-cols-3", masonry: "columns-2 md:columns-3" },
  4: { grid: "grid-cols-2 md:grid-cols-4", masonry: "columns-2 md:columns-4" },
};

/** Sólo se dibujan fotos con enlace https (o ruta propia): nada de `javascript:` ni `data:`. */
function isShowablePhoto(photo: GalleryPhoto): boolean {
  return /^https:\/\//i.test(photo.url) || photo.url.startsWith("/");
}

/** Pixeles que hay que arrastrar a lo ancho para que cuente como deslizar (no como un toque). */
const SWIPE_MIN_PX = 50;

function Lightbox({ photos, startIndex, onClose }: { photos: GalleryPhoto[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const total = photos.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    // Con el visor abierto la página de atrás no tiene que scrollear.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  const photo = photos[index];
  const buttonClass =
    "absolute flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de fotos"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start === null || end === undefined || total < 2) return;
        if (end - start <= -SWIPE_MIN_PX) go(1);
        else if (end - start >= SWIPE_MIN_PX) go(-1);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.alt ?? ""}
        className="max-h-[92vh] max-w-[96vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button type="button" aria-label="Cerrar" className={`${buttonClass} right-4 top-4`} onClick={onClose}>
        ×
      </button>
      {total > 1 ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            className={`${buttonClass} left-4 top-1/2 -translate-y-1/2`}
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Foto siguiente"
            className={`${buttonClass} right-4 top-1/2 -translate-y-1/2`}
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {index + 1} / {total}
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Galería de fotos en grilla o mosaico, con visor a pantalla completa (flechas, teclado y
 * deslizar con el dedo) si el dueño lo dejó encendido. Sin fotos válidas no dibuja nada. */
export function GalleryBlockView({ config }: { config: GalleryBlockConfig }) {
  const photos = config.photos.filter(isShowablePhoto);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);
  if (photos.length === 0) return null;

  const masonry = config.layout === "masonry";
  const columns = COLUMNS_CLASS[config.columns];

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-4">
        {config.title ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        <div className={masonry ? `${columns.masonry} gap-3` : `grid ${columns.grid} gap-3`}>
          {photos.map((photo, i) => {
            const img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.url}
                alt={photo.alt ?? ""}
                loading="lazy"
                className={masonry ? "w-full h-auto rounded-xl" : "aspect-square w-full rounded-xl object-cover"}
              />
            );
            return config.lightbox ? (
              <button
                key={photo.id}
                type="button"
                aria-label={photo.alt ? `Ampliar: ${photo.alt}` : `Ampliar foto ${i + 1}`}
                className={`block w-full cursor-zoom-in ${masonry ? "mb-3 break-inside-avoid" : ""}`}
                onClick={() => setOpenIndex(i)}
              >
                {img}
              </button>
            ) : (
              <div key={photo.id} className={masonry ? "mb-3 break-inside-avoid" : ""}>
                {img}
              </div>
            );
          })}
        </div>
      </div>
      {openIndex !== null ? <Lightbox photos={photos} startIndex={openIndex} onClose={close} /> : null}
    </section>
  );
}
