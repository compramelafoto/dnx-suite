"use client";

import { useCallback, useState } from "react";
import { Visor } from "./visor";

export type FotoDeGaleria = { id: string; url: string; alt: string | null; ancho: number | null; alto: number | null };

/** Fotos que se agregan al mosaico de una vez. Un trabajo de 300 fotos no arma 300 miniaturas al
 * entrar: las primeras van y el resto aparece con «Ver más fotos». */
const TANDA = 48;

/**
 * El mosaico de fotos de un trabajo, con el visor a pantalla completa. No hay redimensionador en
 * el sitio: cada miniatura es la foto original con carga diferida, y `width`/`height` (cuando se
 * conocen) reservan su lugar para que la página no salte mientras cargan.
 */
export function TrabajoGaleria({ fotos, titulo }: { fotos: FotoDeGaleria[]; titulo: string }) {
  const [visibles, setVisibles] = useState(TANDA);
  const [abierta, setAbierta] = useState<number | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);
  if (fotos.length === 0) return null;

  return (
    <div className="space-y-8">
      <div className="columns-2 gap-3 md:columns-3">
        {fotos.slice(0, visibles).map((foto, i) => (
          <button
            key={foto.id}
            type="button"
            aria-label={foto.alt ? `Ampliar: ${foto.alt}` : `Ampliar foto ${i + 1} de ${titulo}`}
            className="mb-3 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl"
            onClick={() => setAbierta(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- las fotos viven en R2, sin redimensionador */}
            <img
              src={foto.url}
              alt={foto.alt ?? ""}
              width={foto.ancho ?? undefined}
              height={foto.alto ?? undefined}
              loading={i < 6 ? "eager" : "lazy"}
              decoding="async"
              className="h-auto w-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--wsite-text) 5%, transparent)" }}
            />
          </button>
        ))}
      </div>
      {visibles < fotos.length ? (
        <div className="text-center">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm"
            style={{
              borderRadius: "var(--wsite-button-radius)",
              paddingInline: "var(--wsite-button-padding-x)",
              paddingBlock: "var(--wsite-button-padding-y)",
              fontWeight: "var(--wsite-button-weight)",
              border: "2px solid var(--wsite-primary)",
              color: "var(--wsite-primary)",
            }}
            onClick={() => setVisibles((v) => v + TANDA)}
          >
            Ver más fotos ({fotos.length - visibles})
          </button>
        </div>
      ) : null}
      {abierta !== null ? <Visor photos={fotos} startIndex={abierta} onClose={cerrar} /> : null}
    </div>
  );
}
