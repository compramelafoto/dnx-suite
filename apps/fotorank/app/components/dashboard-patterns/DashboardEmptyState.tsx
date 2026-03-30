import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DashboardEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
};

/**
 * Estado vacío para vistas de listado / herramienta: proporción controlada, sin cajas enormes.
 * Variantes de uso: sin resultados por filtros, sin datos aún, etc. (mismo shell, copy distinto).
 */
export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: DashboardEmptyStateProps) {
  return (
    <div className="flex justify-center py-6">
      <div className="w-full max-w-md rounded-xl border border-fr-border bg-fr-bg-elevated/85 px-6 py-9 text-center shadow-sm backdrop-blur-[2px] sm:px-8 sm:py-10">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-fr-border bg-fr-card text-gold">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </div>
        <h3 className="font-sans text-base font-semibold tracking-tight text-fr-primary sm:text-lg">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-fr-muted [text-wrap:balance]">{description}</p>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {primaryAction}
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}
