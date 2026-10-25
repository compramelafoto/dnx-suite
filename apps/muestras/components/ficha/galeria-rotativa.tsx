"use client";

import { useEffect, useState } from "react";
import { Galeria, type ObraDeGaleria } from "./galeria";

/**
 * "Cambian para cada visitante" (spec D23). La página llega de caché sin ninguna obra expuesta: al
 * montarse, pide al servidor las N de esta visita. Mientras carga, `cantidad` cuadros vacíos. El
 * visor no enlaza a la página de la obra (en este modo no tiene imagen).
 */
export function GaleriaRotativa({ slug, cantidad }: { slug: string; cantidad: number }) {
  const [obras, setObras] = useState<ObraDeGaleria[] | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/m/${encodeURIComponent(slug)}/anticipo`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { obras: [] }))
      .then((c: { obras?: ObraDeGaleria[] }) => {
        if (vigente) setObras(Array.isArray(c.obras) ? c.obras : []);
      })
      .catch(() => {
        if (vigente) setObras([]);
      });
    return () => {
      vigente = false;
    };
  }, [slug]);

  if (obras && obras.length > 0) {
    return (
      <Galeria
        obras={obras}
        parcial
        cerrada={false}
        slug={slug}
        enlazar={false}
        bajada="Cada vez que entrás ves otras obras de las que están en la sala."
      />
    );
  }
  if (obras) return null;
  return (
    <section className="space-y-4" aria-busy="true">
      <h2 className="mf-titulo text-[clamp(1.5rem,3vw,2rem)]">Anticipo de la muestra</h2>
      <p className="text-[var(--mf-muted)]">Cada vez que entrás ves otras obras de las que están en la sala.</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: Math.min(cantidad, 24) }, (_, i) => (
          <li key={i} aria-hidden className="aspect-[4/5] w-full animate-pulse bg-[var(--mf-surface)]" />
        ))}
      </ul>
    </section>
  );
}
