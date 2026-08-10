"use client";

import { useRouter } from "next/navigation";

type Props = {
  contestId: string;
  index?: number;
  total?: number;
  prevEntryId: string | null;
  nextEntryId: string | null;
};

/**
 * Navegación rápida entre obras del jurado (ETAPA 16B).
 * Anterior/Siguiente navegan dentro del orden anónimo estable del jurado (jury-order.ts).
 * Los enlaces de filtro llevan al listado con `?filter=pending|postponed` — no reordenan nada
 * server-side por sí mismos; el listado interpreta el query param.
 */
export function JuryEntryNav({ contestId, index, total, prevEntryId, nextEntryId }: Props) {
  const router = useRouter();

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-fr-border bg-fr-card px-4 py-3"
      data-testid="jury-entry-nav"
      aria-label="Navegación entre obras"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm"
          disabled={!prevEntryId}
          onClick={() => {
            if (prevEntryId) router.push(`/jurado/concursos/${contestId}/obras/${prevEntryId}`);
          }}
          data-testid="jury-entry-nav-prev"
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm"
          disabled={!nextEntryId}
          onClick={() => {
            if (nextEntryId) router.push(`/jurado/concursos/${contestId}/obras/${nextEntryId}`);
          }}
          data-testid="jury-entry-nav-next"
        >
          Siguiente →
        </button>
        {typeof index === "number" && typeof total === "number" ? (
          <span className="text-sm text-fr-muted">
            Obra {index} de {total}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <a
          href={`/jurado/concursos/${contestId}?filter=pending`}
          className="text-gold hover:text-gold-hover"
          data-testid="jury-entry-nav-filter-pending"
        >
          Ver pendientes
        </a>
        <a
          href={`/jurado/concursos/${contestId}?filter=postponed`}
          className="text-gold hover:text-gold-hover"
          data-testid="jury-entry-nav-filter-postponed"
        >
          Ver postergadas
        </a>
      </div>
    </nav>
  );
}
