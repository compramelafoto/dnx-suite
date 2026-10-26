"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pixeles que hay que arrastrar a lo ancho para que cuente como deslizar (no como un toque). */
const SWIPE_MIN_PX = 50;

/** Lo mínimo que el visor necesita de cada foto. */
export type FotoDelVisor = { id: string; url: string; alt?: string | null };

/**
 * Visor de fotos a pantalla completa: flechas, teclado (← → Escape) y deslizar con el dedo. Sólo
 * carga la foto que se está mirando, así un trabajo de 300 fotos no baja todo de una vez. Lo
 * comparten el bloque Galería y la ficha de un trabajo.
 */
export function Visor({ photos, startIndex, onClose }: { photos: FotoDelVisor[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const total = photos.length;
  useEffect(() => {
    if (total === 0) onClose();
  }, [total, onClose]);

  const go = useCallback((delta: number) => setIndex((i) => (Math.min(i, total - 1) + delta + total) % total), [total]);

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

  // Si la lista de fotos cambia con el visor abierto (edición en vivo), el índice no se sale.
  const safeIndex = Math.min(index, total - 1);
  const photo = photos[safeIndex];
  if (!photo) return null;
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
            {safeIndex + 1} / {total}
          </p>
        </>
      ) : null}
    </div>
  );
}

