"use client";

import { useState } from "react";
import { imageIndexForModel } from "@/lib/store/variant-axes";
import { useProductView } from "./product-view-context";

/**
 * La galería de la ficha: la foto grande arriba y las miniaturas abajo para cambiarla. Sin fotos,
 * un recuadro con el nombre (nunca una imagen rota).
 *
 * Dentro de `ProductViewProvider`, cuando se elige un modelo salta a la foto cuyo texto
 * alternativo es ese modelo (el mockup), si la hay.
 *
 * La foto se ve COMPLETA (sin recortar): el recuadro toma la proporción de la primera foto y
 * cada foto entra entera. Las fotos están apiladas y se cambia de una a otra con un fundido.
 */
export function ProductGallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [actual, setActual] = useState(0);
  const modelo = useProductView()?.model ?? null;
  const [modeloVisto, setModeloVisto] = useState<string | null>(null);
  // Ajuste durante el render (sin efecto): sólo cuando CAMBIA el modelo, así las miniaturas
  // siguen funcionando después.
  if (modelo !== modeloVisto) {
    setModeloVisto(modelo);
    const i = imageIndexForModel(images, modelo);
    if (i >= 0) setActual(i);
  }
  const visible = images[actual] ? actual : 0;
  // Ancho / alto de la primera foto; cuadrado hasta que carga (o si no hay fotos).
  const [proporcion, setProporcion] = useState(1);

  return (
    <div className="min-w-0 space-y-3">
      <div
        className="relative w-full overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)]"
        style={{ aspectRatio: proporcion, backgroundColor: "color-mix(in srgb, var(--fo-text) 5%, transparent)" }}
      >
        {images.length > 0 ? (
          images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${img.url}-${i}`}
              src={img.url}
              alt={i === visible ? (img.alt ?? title) : ""}
              aria-hidden={i === visible ? undefined : true}
              onLoad={
                i === 0
                  ? (e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                      if (w > 0 && h > 0) setProporcion(w / h);
                    }
                  : undefined
              }
              className={`absolute inset-0 h-full w-full object-contain transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
                i === visible ? "scale-100 opacity-100" : "pointer-events-none scale-[1.02] opacity-0"
              }`}
            />
          ))
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
                aria-current={i === visible ? "true" : undefined}
                className={`block h-16 w-16 overflow-hidden rounded-[var(--fo-radius-sm)] border-2 transition-colors ${
                  i === visible ? "border-[var(--fo-accent)]" : "border-transparent opacity-75 hover:opacity-100"
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
