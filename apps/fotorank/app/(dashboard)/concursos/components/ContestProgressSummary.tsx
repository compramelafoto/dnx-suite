"use client";

import type { ModuleInfo } from "../../../lib/fotorank/contestProgress";

interface ContestProgressSummaryProps {
  overallProgress: number;
  modules: ModuleInfo[];
  categoriesCount: number;
  judgesCount: number;
  hasRules: boolean;
  lastUpdated?: Date;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ContestProgressSummary({
  overallProgress,
  modules,
  categoriesCount,
  judgesCount,
  hasRules,
  lastUpdated,
}: ContestProgressSummaryProps) {
  const completeCount = modules.filter((m) => m.status === "COMPLETE").length;
  const totalCount = modules.length;

  return (
    <aside className="fr-recuadro rounded-xl border border-[#262626] bg-[#141414]">
      <h3 className="font-sans text-lg font-semibold text-fr-primary">
        Resumen
      </h3>

      <div className="mt-8 space-y-8">
        {/* Progreso general */}
        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-fr-muted">Progreso general</span>
            <span className="text-sm font-medium text-fr-primary">
              {overallProgress}%
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#262626]">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Módulos completados */}
        <dl className="space-y-4">
          <div className="flex justify-between text-sm">
            <dt className="text-fr-muted">Módulos completados</dt>
            <dd className="font-medium text-fr-primary">
              {completeCount} / {totalCount}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-fr-muted">Categorías</dt>
            <dd className="font-medium text-fr-primary">{categoriesCount}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-fr-muted">Jurados</dt>
            <dd className="font-medium text-fr-primary">{judgesCount}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-fr-muted">Bases y condiciones</dt>
            <dd className="font-medium text-fr-primary">
              {hasRules ? "Generadas" : "Pendientes"}
            </dd>
          </div>
        </dl>

        {lastUpdated && (
          <p className="pt-4 text-xs text-fr-muted-soft">
            Última actualización: {formatDate(lastUpdated)}
          </p>
        )}
      </div>
    </aside>
  );
}
