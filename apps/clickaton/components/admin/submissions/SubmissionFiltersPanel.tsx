"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type ActiveChip = { label: string };

type Props = {
  secondaryFields: ReactNode;
  actions: ReactNode;
  activeChips: ActiveChip[];
  clearHref: string | null;
  formId?: string;
};

/**
 * Filtros de entregas: secundarios colapsables en mobile.
 * Conserva GET + query params existentes.
 */
export function SubmissionFiltersPanel({
  secondaryFields,
  actions,
  activeChips,
  clearHref,
  formId = "admin-submissions-filters",
}: Props) {
  const [open, setOpen] = useState(false);
  const count = activeChips.length;
  const summary = useMemo(
    () =>
      count === 0
        ? "Sin filtros adicionales"
        : `${count} filtro${count === 1 ? "" : "s"} activo${count === 1 ? "" : "s"}`,
    [count],
  );

  return (
    <div className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ck-text">Filtros</p>
          <p className="mt-1 text-xs text-ck-text-muted">{summary}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 sm:hidden"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ocultar filtros" : "Filtros"}
          {count > 0 ? ` (${count})` : ""}
        </Button>
      </div>

      {activeChips.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
          {activeChips.map((chip) => (
            <li key={chip.label}>
              <Badge variant="brand">{chip.label}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={`${open ? "block" : "hidden"} space-y-4 sm:block`} id={formId}>
        <div className="grid gap-4 sm:grid-cols-2">{secondaryFields}</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
          {clearHref ? (
            <Button href={clearHref} variant="text" size="sm" className="min-h-11 justify-center">
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
