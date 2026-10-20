"use client";

import { useState } from "react";
import { Visor } from "@/components/visor/visor";

export type FotoPortfolio = { id: string; imageUrl: string; title: string; year: number | null; technique: string | null; caption: string | null };

/** Miniaturas del portfolio de un artista, con el visor a pantalla completa. Sólo fotos que no se exponen. */
export function FotosPortfolio({ fotos, autor, columnas = "grid-cols-4 sm:grid-cols-8" }: { fotos: FotoPortfolio[]; autor: string; columnas?: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const actual = abierta != null ? fotos[abierta] : null;
  const ir = (d: number) => setAbierta((i) => (i == null ? i : (i + d + fotos.length) % fotos.length));
  if (fotos.length === 0) return null;
  const datos = (f: FotoPortfolio) => [f.year ? String(f.year) : null, f.technique].filter(Boolean).join(". ");

  return (
    <>
      <ul className={`grid gap-2 ${columnas}`}>
        {fotos.map((f, i) => (
          <li key={f.id}>
            <button type="button" className="block w-full bg-[var(--mf-surface)]" onClick={() => setAbierta(i)} aria-label={`Ver ${f.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.imageUrl} alt={`${f.title}, de ${autor}`} loading="lazy" className="aspect-square w-full object-cover transition-opacity duration-300 hover:opacity-85" />
            </button>
          </li>
        ))}
      </ul>
      {actual ? (
        <Visor
          etiqueta={`Portfolio de ${autor}`}
          onCerrar={() => setAbierta(null)}
          onIr={ir}
          pie={<><strong className="font-medium text-white">{actual.title}</strong>, de {autor}{datos(actual) ? `, ${datos(actual)}` : ""}{actual.caption ? `. ${actual.caption}` : ""}</>}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={actual.imageUrl} alt={`${actual.title}, de ${autor}`} className="mx-auto h-full w-full object-contain" />
        </Visor>
      ) : null}
    </>
  );
}
