"use client";

import { useEffect, useState } from "react";
import type { TestimonioPublico } from "@/lib/testimonios/publico";
import { BLOG_HEADING_STYLE, BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import { urlMostrable } from "@/components/website/render/trabajos/trabajos-grilla";
import { TextoLeerMas } from "./texto-leer-mas";

/** Cada cuánto pasa al siguiente. Se frena con el mouse encima o con el foco adentro (por ejemplo, después de tocar «Leer más»). */
const INTERVALO_MS = 7000;

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Testimonios en banner: uno por vez, centrado, con la foto del autor chica y redonda arriba, el nombre
 * y el texto abajo. Pasa solo cada `INTERVALO_MS` (salvo con «reducir movimiento»), con flechas y puntos
 * para elegir. Todos los testimonios están en el HTML (para buscadores y lectores de pantalla): se
 * oculta el que no toca, no se desmonta.
 */
export function TestimoniosBanner({ testimonios }: { testimonios: readonly TestimonioPublico[] }) {
  const [actual, setActual] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const total = testimonios.length;

  useEffect(() => {
    if (total < 2 || quieto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setActual((i) => (i + 1) % total), INTERVALO_MS);
    return () => window.clearInterval(t);
  }, [total, quieto]);

  const ir = (i: number) => setActual(((i % total) + total) % total);
  const flecha = "flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-opacity hover:opacity-70";

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label="Testimonios"
      className="mx-auto max-w-3xl"
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      onFocusCapture={() => setQuieto(true)}
      onBlurCapture={() => setQuieto(false)}
    >
      <div className="grid">
        {testimonios.map((t, i) => {
          const visible = i === actual;
          return (
            <figure
              key={t.id}
              aria-hidden={!visible}
              className="col-start-1 row-start-1 flex flex-col items-center gap-5 px-2 text-center transition-opacity duration-700"
              style={{ opacity: visible ? 1 : 0, visibility: visible ? "visible" : "hidden", color: "var(--wsite-text)" }}
            >
              {urlMostrable(t.autorFotoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element -- las fotos viven en R2
                <img
                  src={t.autorFotoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-28 w-28 rounded-full object-cover object-[50%_25%] shadow-md sm:h-32 sm:w-32"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-28 w-28 items-center justify-center rounded-full text-2xl font-semibold sm:h-32 sm:w-32"
                  style={{ backgroundColor: "color-mix(in srgb, var(--wsite-primary) 15%, transparent)", color: "var(--wsite-primary)" }}
                >
                  {iniciales(t.autorNombre)}
                </span>
              )}
              <figcaption className="flex flex-col items-center">
                <span className="text-lg font-semibold" style={BLOG_HEADING_STYLE}>
                  {t.autorNombre}
                </span>
                {t.autorDetalle ? <span className="text-sm opacity-70">{t.autorDetalle}</span> : null}
              </figcaption>
              <blockquote className="max-w-2xl space-y-3 text-base leading-relaxed sm:text-lg">
                {t.extracto ? (
                  <p className="text-xl leading-snug break-words" style={BLOG_HEADING_STYLE}>
                    «{t.extracto}»
                  </p>
                ) : null}
                <TextoLeerMas texto={t.texto} />
              </blockquote>
            </figure>
          );
        })}
      </div>
      {total > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            aria-label="Testimonio anterior"
            className={flecha}
            style={{ borderColor: BLOG_SOFT_BORDER, color: "var(--wsite-text)" }}
          >
            ←
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            {testimonios.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Testimonio ${i + 1} de ${total}`}
                aria-current={i === actual}
                className="h-2.5 w-2.5 rounded-full transition-opacity"
                style={{ backgroundColor: "var(--wsite-primary)", opacity: i === actual ? 1 : 0.25 }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            aria-label="Testimonio siguiente"
            className={flecha}
            style={{ borderColor: BLOG_SOFT_BORDER, color: "var(--wsite-text)" }}
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
