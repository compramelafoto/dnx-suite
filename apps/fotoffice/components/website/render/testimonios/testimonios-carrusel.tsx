"use client";

import { useRef } from "react";
import type { TestimonioPublico } from "@/lib/testimonios/publico";
import { BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import { TestimonioCard } from "./testimonio-card";

/**
 * Carrusel de testimonios con desplazamiento anclado nativo (el gesto del dedo es el del sistema y
 * la cantidad visible la decide el CSS: una en el teléfono, dos o tres en pantallas anchas). Las
 * flechas corren una tarjeta. `items-start`: cada tarjeta mide lo que ocupa su texto — si se estiraran
 * a la más larga, una cita corta quedaría con un hueco enorme abajo (lección de Clickatón).
 */
export function TestimoniosCarrusel({ testimonios }: { testimonios: readonly TestimonioPublico[] }) {
  const pistaRef = useRef<HTMLUListElement>(null);

  function mover(direccion: 1 | -1) {
    const pista = pistaRef.current;
    const tarjeta = pista?.children[0] as HTMLElement | undefined;
    if (!pista || !tarjeta) return;
    const paso = tarjeta.getBoundingClientRect().width + 24;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pista.scrollBy({ left: direccion * paso, behavior: quieto ? "auto" : "smooth" });
  }

  const flecha = "flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-opacity hover:opacity-70";

  return (
    <div role="group" aria-roledescription="carrusel" aria-label="Testimonios">
      <ul
        ref={pistaRef}
        className="flex snap-x snap-mandatory items-start gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {testimonios.map((t) => (
          <li key={t.id} className="w-full shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]">
            <TestimonioCard testimonio={t} />
          </li>
        ))}
      </ul>
      {testimonios.length > 1 ? (
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={() => mover(-1)} aria-label="Testimonio anterior" className={flecha} style={{ borderColor: BLOG_SOFT_BORDER, color: "var(--wsite-text)" }}>
            ←
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Testimonio siguiente" className={flecha} style={{ borderColor: BLOG_SOFT_BORDER, color: "var(--wsite-text)" }}>
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
