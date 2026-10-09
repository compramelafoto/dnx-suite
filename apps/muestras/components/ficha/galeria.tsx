"use client";

import { useState } from "react";

type Obra = { id: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null };

/** Grilla con visor a pantalla completa. Flechas y Escape del teclado funcionan en el visor. */
export function Galeria({ obras, parcial }: { obras: Obra[]; parcial: boolean }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const actual = abierta != null ? obras[abierta] : null;
  const ir = (d: number) => setAbierta((i) => (i == null ? i : (i + d + obras.length) % obras.length));

  return (
    <section className="space-y-3">
      {parcial ? <p className="text-[var(--mf-muted)]">Estás viendo una selección. Visitala en persona: la galería completa se publica cuando cierra.</p> : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {obras.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="block w-full" onClick={() => setAbierta(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt={`${o.title}, de ${o.authorName}`} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
            <p className="mt-1 text-sm">{o.title} · <span className="text-[var(--mf-muted)]">{o.authorName}</span></p>
          </li>
        ))}
      </ul>
      {actual ? (
        <div
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 text-white"
          onKeyDown={(e) => { if (e.key === "Escape") setAbierta(null); if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); }}
          ref={(el) => el?.focus()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={actual.imageUrl} alt={actual.title} className="max-h-[80vh] max-w-full object-contain" />
          <p className="mt-3 text-center">
            <strong>{actual.title}</strong> · {actual.authorName}
            {actual.year ? `, ${actual.year}` : ""}{actual.technique ? ` · ${actual.technique}` : ""}
          </p>
          <div className="mt-3 flex gap-6">
            <button onClick={() => ir(-1)}>← Anterior</button>
            <button onClick={() => setAbierta(null)}>Cerrar</button>
            <button onClick={() => ir(1)}>Siguiente →</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
