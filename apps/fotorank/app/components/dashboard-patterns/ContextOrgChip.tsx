import type { ReactNode } from "react";

type ContextOrgChipProps = {
  /** Etiqueta corta, ej. "Organización" */
  label: string;
  /** Nombre u otro valor destacado */
  value: string;
  /** Contenido extra (ej. switcher) */
  children?: ReactNode;
};

/**
 * Metadata contextual de organización: no debe parecer un input a pantalla completa.
 */
export function ContextOrgChip({ label, value, children }: ContextOrgChipProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <div className="inline-flex max-w-full items-center gap-2.5">
        <span className="shrink-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fr-muted">{label}</span>
        <span className="truncate rounded-full border border-fr-border/90 bg-fr-bg-elevated px-3 py-1.5 text-sm font-medium text-fr-primary">
          {value}
        </span>
      </div>
      {children ? <div className="min-w-0 flex-1 sm:max-w-md">{children}</div> : null}
    </div>
  );
}
