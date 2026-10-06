"use client";

import { useEffect, useState } from "react";
import type { ShowcaseItem } from "@/lib/contests/showcase";
import { ContestCard } from "./contest-card";

const INTERVALO_MS = 5000;

/**
 * La vitrina de concursos de a una ficha: ocupa el lugar de una tarjeta en la columna lateral y
 * va pasando sola. Todas las fichas se apilan en la misma celda de la grilla, así el alto queda
 * fijo (el de la más alta) y el cambio es un fundido sin saltos. Se frena cuando el socio pasa el
 * mouse o la enfoca con el teclado, y no se mueve si el sistema pide menos animaciones.
 */
export function ContestCarousel({
  items,
  institution,
  now,
}: {
  items: ShowcaseItem[];
  institution: string;
  now: Date;
}) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (items.length < 2 || pausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActual((i) => (i + 1) % items.length), INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [items.length, pausado]);

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="space-y-3"
    >
      <div className="grid">
        {items.map((c, i) => (
          <div
            key={c.key}
            aria-hidden={i !== actual}
            inert={i !== actual}
            className={`[grid-area:1/1] transition-all duration-700 ease-out motion-reduce:transition-none ${
              i === actual ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0"
            }`}
          >
            <ContestCard item={c} institution={institution} now={now} className="h-full" />
          </div>
        ))}
      </div>

      {items.length > 1 ? (
        <div className="flex justify-center gap-1.5">
          {items.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Ver ${c.title}`}
              aria-current={i === actual}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === actual ? "w-5 bg-[var(--fo-accent)]" : "w-1.5 bg-[var(--fo-border)] hover:bg-[var(--fo-muted-soft)]"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
