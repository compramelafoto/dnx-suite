import type { ReactNode } from "react";

type FilterSidebarCardProps = {
  title: string;
  /** Contenido del formulario de filtros. */
  children: ReactNode;
  /** Botones Aplicar / Limpiar u otras acciones. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Panel lateral de filtros: superficie elevada, cabecera compacta, campos con ritmo uniforme.
 */
export function FilterSidebarCard({ title, children, footer, className = "" }: FilterSidebarCardProps) {
  return (
    <aside
      className={`overflow-hidden rounded-xl border border-fr-border bg-fr-card shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto ${className}`}
    >
      <div className="border-b border-fr-border/80 px-5 py-3.5">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-fr-muted">{title}</h2>
      </div>
      <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
      {footer ? <div className="border-t border-fr-border/80 bg-fr-bg/40 px-5 py-4">{footer}</div> : null}
    </aside>
  );
}

/** Label + control: gap compacto (12px) para paneles de filtro. */
export function FilterField({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="block text-xs font-medium text-fr-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
