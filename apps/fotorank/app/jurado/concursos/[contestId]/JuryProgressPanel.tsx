type Props = {
  completed: number;
  total: number;
  /** Segundos promedio por foto — solo si hay datos reales (heartbeat). Nunca inventar. */
  avgSecondsPerPhoto?: number | null;
  /** Etiqueta de estimación de tiempo restante, ya formateada por el padre. Opcional. */
  etaLabel?: string | null;
};

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

/**
 * Panel de progreso del jurado (ETAPA 16A). 100% props-driven: si no hay datos de
 * tiempo real (heartbeat de actividad), no se muestra "Estimación" — nunca se inventa.
 */
export function JuryProgressPanel({ completed, total, avgSecondsPerPhoto, etaLabel }: Props) {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.max(0, Math.min(completed, safeTotal));
  const percent = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
  const remaining = safeTotal - safeCompleted;

  const computedEta =
    etaLabel ?? (avgSecondsPerPhoto && remaining > 0 ? formatSeconds(avgSecondsPerPhoto * remaining) : null);

  return (
    <section
      className="fr-recuadro space-y-4 border border-fr-border bg-fr-card"
      data-testid="jury-progress-panel"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-fr-primary">Tu progreso</h2>
        <p className="text-sm text-fr-muted">
          {safeCompleted} de {safeTotal} obras
        </p>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-fr-bg/60">
        <div
          className="h-full rounded-full bg-gold transition-[width]"
          style={{ width: `${percent}%` }}
          data-testid="jury-progress-bar"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-gold">{percent}% completado</span>
        {computedEta ? (
          <span className="text-fr-muted" data-testid="jury-progress-eta">
            Estimación: {computedEta} restantes
          </span>
        ) : null}
        {avgSecondsPerPhoto ? (
          <span className="text-fr-muted" data-testid="jury-progress-avg-seconds">
            {Math.round(avgSecondsPerPhoto)} s/foto
          </span>
        ) : null}
      </div>
    </section>
  );
}
