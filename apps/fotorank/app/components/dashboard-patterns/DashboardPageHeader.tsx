import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  /** Migas, categoría o contexto (opcional). */
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  /** Acciones alineadas a la derecha en desktop (ej. enlaces secundarios). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Cabecera estándar de vistas de herramienta en dashboard Fotorank:
 * metadata opcional → título → descripción compacta; acciones con jerarquía secundaria.
 */
export function DashboardPageHeader({ eyebrow, title, description, actions, className = "" }: DashboardPageHeaderProps) {
  return (
    <header className={`fr-dashboard-page-shell ${className}`}>
      <div className="flex flex-col gap-6 border-b border-fr-border/60 pb-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="min-w-0 flex-1 space-y-4">
          {eyebrow ? <div className="min-h-0">{eyebrow}</div> : null}
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-fr-muted [text-wrap:balance]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:justify-end lg:pt-0.5">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
