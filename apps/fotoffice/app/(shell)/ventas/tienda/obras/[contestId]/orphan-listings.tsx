"use client";

import { useState, useTransition } from "react";
import type { OrphanListingRow } from "@/lib/store/artworks/catalog";
import { unpublishArtworkAction, type ContestActionResult } from "./actions";
import { ContestResult } from "./contest-result";

/**
 * Obras publicadas que ya no están en el concurso (rechazadas o retiradas en FotoRank). La tienda
 * ya no las muestra ni las vende; acá se despublican para dejar la ficha en orden.
 */
export function OrphanListings({ contestId, rows }: { contestId: string; rows: OrphanListingRow[] }) {
  const [resultado, setResultado] = useState<ContestActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <section className="fo-card space-y-3 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Obras que ya no están en el concurso</h2>
        <p className="fo-helper">
          Estaban publicadas, pero en FotoRank fueron rechazadas o el autor las retiró. La tienda ya no las muestra ni
          las vende; despublicalas para sacarlas también de esta lista.
        </p>
      </div>
      <ContestResult resultado={resultado} />
      <ul className="divide-y divide-[var(--fo-border)] text-sm">
        {rows.map((r) => (
          <li key={r.entryId} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{r.title}</span>
              <span className="text-[var(--fo-muted)]"> · {r.reason}</span>
            </span>
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-xs"
              disabled={pendiente}
              onClick={() => {
                if (!window.confirm(`¿Sacar "${r.title}" de la tienda? Los pedidos ya hechos no cambian.`)) return;
                setResultado(null);
                startTransition(async () => setResultado(await unpublishArtworkAction(contestId, r.entryId)));
              }}
            >
              Despublicar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
