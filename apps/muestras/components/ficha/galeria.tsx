"use client";

import Link from "next/link";
import { useState } from "react";
import { workPath } from "@repo/muestras";
import { Visor } from "@/components/visor/visor";

type Obra = { id: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null };

/** Grilla de obras con visor a pantalla completa. Flechas y Escape del teclado funcionan en el visor. */
export function Galeria({ obras, parcial, cerrada, slug }: { obras: Obra[]; parcial: boolean; cerrada: boolean; slug: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const actual = abierta != null ? obras[abierta] : null;
  const ir = (d: number) => setAbierta((i) => (i == null ? i : (i + d + obras.length) % obras.length));

  return (
    <section className="space-y-4">
      {/* Mientras está abierta, lo online es un anticipo que invita a ir; al cerrar, el archivo. */}
      <h2 className="mf-titulo text-[clamp(1.5rem,3vw,2rem)]">{cerrada ? "Archivo de la muestra" : "Anticipo de la muestra"}</h2>
      <p className="text-[var(--mf-muted)]">
        {cerrada
          ? "Las obras que se colgaron en la sala, para quien no llegó a verla."
          : parcial
            ? "Una selección de lo que vas a ver en la sala. Las demás obras quedan online cuando la muestra cierra."
            : "Lo que vas a ver en la sala. Las obras se disfrutan mejor en persona."}
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {obras.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="block w-full bg-[var(--mf-surface)]" onClick={() => setAbierta(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt={`${o.title}, de ${o.authorName}`} loading="lazy" className="aspect-[4/5] w-full object-cover transition-opacity duration-300 hover:opacity-85" />
            </button>
            <p className="mt-2 text-sm font-medium">{o.title}</p>
            <p className="text-sm text-[var(--mf-muted)]">{o.authorName}</p>
          </li>
        ))}
      </ul>
      {actual ? (
        <Visor
          etiqueta="Obras de la muestra"
          onCerrar={() => setAbierta(null)}
          onIr={ir}
          pie={<><strong className="font-medium text-white">{actual.title}</strong>, de {actual.authorName}{actual.year ? `, ${actual.year}` : ""}{actual.technique ? `. ${actual.technique}` : ""}{" "}<Link href={workPath(slug, actual.id)} className="ml-2 text-white underline underline-offset-4">Ver la obra</Link></>}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={actual.imageUrl} alt={`${actual.title}, de ${actual.authorName}`} className="mx-auto h-full w-full object-contain" />
        </Visor>
      ) : null}
    </section>
  );
}
