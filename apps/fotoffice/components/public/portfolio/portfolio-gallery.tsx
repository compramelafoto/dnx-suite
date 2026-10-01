"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PublicPortfolioPhoto } from "@/lib/portfolio/public-queries";

/**
 * La galería de una ficha, con visor a pantalla completa.
 *
 * El visor es un `<dialog>` nativo: el navegador se ocupa del foco atrapado, de Escape y de la capa
 * por encima de todo. Reimplementar eso a mano sale casi siempre mal — el caso que se olvida es el
 * de quien navega con teclado, que termina tabulando por detrás del visor abierto.
 *
 * Las flechas ← y → cambian de foto; la última vuelve a la primera, porque llegar al final y que no
 * pase nada se siente como que algo se rompió.
 */
export function PortfolioGallery({
  photos,
  authorName,
}: {
  photos: PublicPortfolioPhoto[];
  authorName: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  const mover = useCallback(
    (paso: number) => {
      setAbierta((actual) => {
        if (actual === null) return actual;
        return (actual + paso + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta !== null && !d.open) d.showModal();
    if (abierta === null && d.open) d.close();
  }, [abierta]);

  useEffect(() => {
    if (abierta === null) return;
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [abierta, mover]);

  if (photos.length === 0) return null;

  const foto = abierta === null ? null : photos[abierta];

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((f, indice) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setAbierta(indice)}
              className="block w-full overflow-hidden rounded"
              aria-label={`Ampliar ${f.title ?? `foto ${indice + 1}`}`}
              style={{ backgroundColor: "color-mix(in srgb, var(--wsite-text) 8%, transparent)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={f.title ?? `Obra de ${authorName}`}
                width={f.width}
                height={f.height}
                loading="lazy"
                className="w-full object-cover"
                style={{ aspectRatio: `${f.width} / ${f.height}` }}
              />
            </button>
            {f.title || f.year ? (
              <p className="mt-2 text-xs opacity-70">
                {f.title}
                {f.title && f.year ? " · " : null}
                {f.year}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogo}
        onClose={() => setAbierta(null)}
        className="max-h-[100dvh] max-w-[100vw] bg-transparent p-0 backdrop:bg-black/85"
        aria-label="Visor de obra"
      >
        {foto ? (
          <div className="relative flex h-[100dvh] w-[100vw] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt={foto.title ?? `Obra de ${authorName}`}
              width={foto.width}
              height={foto.height}
              className="max-h-full max-w-full object-contain"
            />

            <button
              type="button"
              onClick={() => setAbierta(null)}
              aria-label="Cerrar el visor"
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
            >
              <X size={20} aria-hidden />
            </button>

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Foto anterior"
                  className="absolute left-4 rounded-full bg-black/60 p-2 text-white"
                >
                  <ChevronLeft size={24} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Foto siguiente"
                  className="absolute right-4 rounded-full bg-black/60 p-2 text-white"
                >
                  <ChevronRight size={24} aria-hidden />
                </button>
              </>
            ) : null}

            {foto.title || foto.year ? (
              <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/90">
                {foto.title}
                {foto.title && foto.year ? " · " : null}
                {foto.year}
              </p>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
