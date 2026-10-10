"use client";

import Link from "next/link";
import { useState } from "react";
import { workPath } from "@repo/muestras";
import { Visor } from "@/components/visor/visor";

type Obra = { id: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null };

/** Grilla de obras con visor a pantalla completa. Flechas y Escape del teclado funcionan en el visor. */
export type ObraDeGaleria = Obra;

/**
 * `parcial`: online se ve sólo una parte (la sorpresa reserva el resto para la sala). `seRevela`:
 * si al cerrar quedan todas online (no se promete el archivo si la reserva sigue). `enlazar`: el
 * visor lleva a la página de la obra (en "cambian para cada visitante" no: esas páginas no tienen
 * imagen). `bajada` reemplaza el texto de abajo del título.
 */
export function Galeria({ obras, parcial, cerrada, slug, seRevela = true, enlazar = true, bajada }: {
  obras: Obra[];
  parcial: boolean;
  cerrada: boolean;
  slug: string;
  seRevela?: boolean;
  enlazar?: boolean;
  bajada?: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const actual = abierta != null ? obras[abierta] : null;
  const ir = (d: number) => setAbierta((i) => (i == null ? i : (i + d + obras.length) % obras.length));

  return (
    <section className="space-y-4">
      {/* Mientras está abierta, lo online es un anticipo que invita a ir; al cerrar, el archivo. */}
      <h2 className="mf-titulo text-[clamp(1.5rem,3vw,2rem)]">{cerrada ? (parcial ? "Obras de la muestra" : "Archivo de la muestra") : "Anticipo de la muestra"}</h2>
      <p className="text-[var(--mf-muted)]">
        {bajada ??
          (cerrada
            ? parcial
              ? "Algunas de las obras que se colgaron en la sala."
              : "Las obras que se colgaron en la sala, para quien no llegó a verla."
            : parcial
              ? `Algunas de las obras que vas a ver en la sala. Las demás se descubren allá${seRevela ? " y quedan online cuando la muestra cierra" : ""}.`
              : "Lo que vas a ver en la sala. Las obras se disfrutan mejor en persona.")}
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
          pie={<><strong className="font-medium text-white">{actual.title}</strong>, de {actual.authorName}{actual.year ? `, ${actual.year}` : ""}{actual.technique ? `. ${actual.technique}` : ""}{enlazar ? <>{" "}<Link href={workPath(slug, actual.id)} className="ml-2 text-white underline underline-offset-4">Ver la obra</Link></> : null}</>}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={actual.imageUrl} alt={`${actual.title}, de ${actual.authorName}`} className="mx-auto h-full w-full object-contain" />
        </Visor>
      ) : null}
    </section>
  );
}
