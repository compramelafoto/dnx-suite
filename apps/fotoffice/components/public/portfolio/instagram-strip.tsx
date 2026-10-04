"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * La franja de posteos de Instagram, debajo de la obra.
 *
 * ── Qué es y qué no ──
 *
 * **No es el feed.** Leer las últimas fotos de una cuenta exige OAuth y una app aprobada por Meta
 * desde que cerró la Basic Display API, en diciembre de 2024. Esto son posteos que el socio eligió
 * y pegó; los renderiza el propio script de Instagram, con su diseño.
 *
 * ── Dos consecuencias de usar el script de Meta ──
 *
 * 1. **Trae un tercero al sitio de la institución.** Por eso la franja nace apagada y se prende a
 *    mano: no es una decisión que se herede.
 * 2. **Puede no cargar** —bloqueadores, posteo borrado, cuenta pasada a privada—. Cuando eso pasa,
 *    el `blockquote` se queda como está, y adentro tiene un enlace al posteo. Degrada a un enlace
 *    que funciona en vez de a un hueco.
 *
 * Se carga en horizontal con desplazamiento por arrastre o con los dos botones, que existen para
 * quien usa teclado o mouse sin rueda horizontal.
 */
export function InstagramStrip({ posts, handle }: { posts: string[]; handle: string | null }) {
  const carril = useRef<HTMLDivElement>(null);

  /** Cada vez que cambian los posteos hay que pedirle al script que los vuelva a dibujar. */
  useEffect(() => {
    const w = window as unknown as { instgrm?: { Embeds?: { process?: () => void } } };
    w.instgrm?.Embeds?.process?.();
  }, [posts]);

  if (posts.length === 0) return null;

  function desplazar(direccion: 1 | -1) {
    const c = carril.current;
    if (!c) return;
    const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    c.scrollBy({
      left: direccion * Math.max(c.clientWidth * 0.8, 280),
      behavior: menosMovimiento ? "auto" : "smooth",
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="fo-ig-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="fo-ig-titulo" className="text-xl font-semibold tracking-tight">
            En Instagram
          </h2>
          {handle ? (
            <a
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline opacity-70"
            >
              @{handle}
            </a>
          ) : null}
        </div>

        {posts.length > 1 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => desplazar(-1)}
              aria-label="Ver posteos anteriores"
              className="rounded-full border p-2 transition-opacity hover:opacity-70"
              style={{ borderColor: "var(--wsite-text)" }}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => desplazar(1)}
              aria-label="Ver posteos siguientes"
              className="rounded-full border p-2 transition-opacity hover:opacity-70"
              style={{ borderColor: "var(--wsite-text)" }}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={carril}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {posts.map((url) => (
          <div key={url} className="w-[min(320px,85vw)] shrink-0 snap-start">
            {/*
              La estructura que espera el script de Instagram. Si no carga —bloqueador, posteo
              borrado, cuenta privada— queda este enlace, que sigue llevando al posteo.
            */}
            <blockquote
              className="instagram-media w-full rounded-lg"
              data-instgrm-permalink={url}
              data-instgrm-version="14"
              style={{ background: "#FFF", margin: 0, minWidth: "unset", width: "100%" }}
            >
              <a href={url} target="_blank" rel="noopener noreferrer" className="block p-4 text-sm">
                Ver este posteo en Instagram
              </a>
            </blockquote>
          </div>
        ))}
      </div>

      {/* `lazyOnload`: la obra del fotógrafo carga primero. El script de Meta puede esperar. */}
      <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
    </section>
  );
}
