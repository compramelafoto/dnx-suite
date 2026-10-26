"use client";

import { useCallback, useState } from "react";
import type { GalleryBlockConfig, GalleryPhoto } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";
import { Visor } from "@/components/website/render/trabajos/visor";

const COLUMNS_CLASS: Record<GalleryBlockConfig["columns"], { grid: string; masonry: string }> = {
  2: { grid: "grid-cols-1 sm:grid-cols-2", masonry: "columns-1 sm:columns-2" },
  3: { grid: "grid-cols-2 md:grid-cols-3", masonry: "columns-2 md:columns-3" },
  4: { grid: "grid-cols-2 md:grid-cols-4", masonry: "columns-2 md:columns-4" },
};

/** Sólo se dibujan fotos con enlace https (o ruta propia): nada de `javascript:` ni `data:`. */
function isShowablePhoto(photo: GalleryPhoto): boolean {
  return /^https:\/\//i.test(photo.url) || /^\/(?![\/\\])/.test(photo.url);
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
      {openIndex !== null ? <Visor photos={photos} startIndex={openIndex} onClose={close} /> : null}
    </section>
  );
}
