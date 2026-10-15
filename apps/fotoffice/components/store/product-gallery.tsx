"use client";

import { useState } from "react";

/**
 * La galería de la ficha: la foto grande arriba y las miniaturas abajo para cambiarla. Sin fotos,
 * un recuadro con el nombre (nunca una imagen rota).
 */
export function ProductGallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [actual, setActual] = useState(0);
  const foto = images[actual] ?? images[0];

  return (
    <div className="min-w-0 space-y-3">
      <div
        className="aspect-square w-full overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)]"
        style={{ backgroundColor: "color-mix(in srgb, var(--fo-text) 5%, transparent)" }}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt={foto.alt ?? title} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-6 text-center text-[var(--fo-muted)]">{title}</span>
        )}
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Fotos del producto">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setActual(i)}
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-current={i === actual ? "true" : undefined}
                className={`block h-16 w-16 overflow-hidden rounded-[var(--fo-radius-sm)] border-2 transition-colors ${
                  i === actual ? "border-[var(--fo-accent)]" : "border-transparent opacity-75 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
