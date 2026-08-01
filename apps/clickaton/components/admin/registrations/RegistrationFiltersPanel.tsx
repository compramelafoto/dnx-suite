"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type ActiveChip = { label: string };

type Props = {
  /** Controles principales siempre visibles (edición + búsqueda). */
  primaryFields: ReactNode;
  /** Controles secundarios (estado, pago, talles, etc.). */
  secondaryFields: ReactNode;
  /** Botones submit / export. */
  actions: ReactNode;
  activeChips: ActiveChip[];
  clearHref: string | null;
  formId?: string;
};

/**
 * Filtros admin: principales visibles; secundarios en acordeón (especialmente útil en mobile).
 * Conserva GET + URL params existentes.
 */
export function RegistrationFiltersPanel({
  primaryFields,
  secondaryFields,
  actions,
  activeChips,
  clearHref,
  formId = "admin-registrations-filters",
}: Props) {
  const [open, setOpen] = useState(false);
  const count = activeChips.length;
  const summary = useMemo(
    () => (count === 0 ? "Sin filtros adicionales" : `${count} filtro${count === 1 ? "" : "s"} activo${count === 1 ? "" : "s"}`),
    [count],
  );

  return (
    <div className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">{primaryFields}</div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
          {activeChips.map((chip) => (
            <Badge key={chip.label} variant="brand">
              {chip.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--ck-radius-control)] border border-ck-border px-4 text-sm font-semibold text-ck-text hover:border-ck-yellow"
          aria-expanded={open}
          aria-controls={`${formId}-more`}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ocultar filtros" : "Más filtros"}
          <span className="ml-2 text-ck-text-muted">({summary})</span>
        </button>
        {clearHref ? (
          <Button href={clearHref} variant="outline" className="min-h-11 w-full sm:w-auto">
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      <div
        id={`${formId}-more`}
        className={open ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "hidden"}
        hidden={!open}
      >
        {secondaryFields}
      </div>

      <div className="flex w-full flex-col gap-3 border-t border-ck-border pt-4 sm:flex-row sm:flex-wrap sm:items-end">
        {actions}
      </div>
    </div>
  );
}
