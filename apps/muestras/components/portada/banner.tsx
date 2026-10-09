"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FotoPortada } from "@/lib/portada/fotos";

/** Cada cuánto cambia la foto. El fundido dura 1,2 s (`.mf-fundido`). */
const INTERVALO_MS = 6000;

/**
 * Banner a sangre de la portada. Las fotos se funden lento una sobre otra; sin flechas ni
 * puntitos. Con "reducir movimiento" se queda en la primera. Sin fotos, fondo tinta.
 */
export function Banner({ fotos }: { fotos: FotoPortada[] }) {
  const [actual, setActual] = useState(0);
  // Cuántas fotos ya se montaron: la actual y la siguiente, para que el fundido no espere a la
  // descarga. Las demás se piden recién cuando les toca.
  const [montadas, setMontadas] = useState(Math.min(2, fotos.length));

  useEffect(() => {
    if (fotos.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reloj = window.setInterval(() => {
      if (document.hidden) return;
      setActual((i) => (i + 1) % fotos.length);
      // Cada paso monta una más: la que sigue a la que ahora entra.
      setMontadas((m) => Math.min(m + 1, fotos.length));
    }, INTERVALO_MS);
    return () => window.clearInterval(reloj);
  }, [fotos.length]);

  const visible = fotos[actual];

  return (
    <section id="portada" aria-labelledby="titulo-portada" className="mf-sobre-foto relative h-[82svh] min-h-[540px] overflow-hidden bg-[var(--mf-ink)] text-white sm:h-svh sm:min-h-[640px]">
      {fotos.slice(0, montadas).map((f, i) => (
        <Image
          key={f.src}
          src={f.src}
          alt={f.alt}
          aria-hidden={i !== actual}
          fill
          sizes="100vw"
          preload={i === 0}
          className={`mf-fundido object-cover ${i === actual ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {fotos.length > 0 ? (
        <>
          <div aria-hidden className="mf-sombra-arriba absolute inset-x-0 top-0 h-40" />
          <div aria-hidden className="mf-sombra-texto absolute inset-0" />
        </>
      ) : null}

      <div className="mf-marco mf-texto-sobre-foto absolute inset-x-0 bottom-0 flex flex-col gap-8 pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-12">
        <div className="max-w-4xl">
          <h1 id="titulo-portada" className="mf-nombre text-[clamp(3.6rem,10.5vw,10.5rem)]">
            Muestras<br />Fotográficas
          </h1>
          <p className="mt-6 max-w-[36ch] text-balance text-lg leading-snug text-white/90 sm:text-xl">Todas las muestras de fotografía del país, en un solo lugar.</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-[15px]">
            <a href="#muestras" className="inline-flex h-11 items-center border border-white/80 px-5 transition-colors hover:bg-white hover:text-[var(--mf-ink)]">Ver muestras</a>
            <Link href="/proponer" className="underline decoration-white/50 underline-offset-[6px] hover:decoration-white">Proponé la tuya</Link>
          </div>
        </div>
        {visible ? <p className="shrink-0 text-xs text-white/85">Fotografía: {visible.autor}</p> : null}
      </div>
    </section>
  );
}
