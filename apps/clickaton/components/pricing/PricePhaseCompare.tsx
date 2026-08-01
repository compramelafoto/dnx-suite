import { cn } from "@/lib/cn";
import type { PriceComparePresentation } from "@/lib/admin/pricing/ui/commercial-status-presentation";

type Props = {
  compare: PriceComparePresentation;
  className?: string;
  /** Variante más compacta para listados / wizard. */
  compact?: boolean;
};

/**
 * Precio actual + próximo tachado cuando la próxima fase es más cara.
 * Solo presentación; no calcula montos.
 */
export function PricePhaseCompare({ compare, className, compact }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {!compact ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
            {compare.currentLabel}
          </span>
        ) : null}
        <span
          className={cn(
            "font-semibold text-ck-text",
            compact ? "text-base" : "text-2xl sm:text-3xl",
          )}
        >
          {compare.currentAmountLabel}
        </span>
        {compare.showNextStruck && compare.nextAmountLabel ? (
          <span
            className={cn(
              "text-ck-text-muted line-through decoration-2",
              compact ? "text-sm" : "text-lg",
            )}
            aria-label={`Próximo precio ${compare.nextAmountLabel}`}
          >
            {compare.nextAmountLabel}
          </span>
        ) : null}
      </div>
      {compare.currentPhaseName ? (
        <p className={cn("text-ck-text-secondary", compact ? "text-xs" : "text-sm")}>
          {compare.currentPhaseName}
          {compare.currentEndsLabel ? ` · vigente hasta ${compare.currentEndsLabel}` : null}
        </p>
      ) : null}
      {compare.showNextStruck && compare.nextStartsLabel ? (
        <p className={cn("text-ck-text-muted", compact ? "text-xs" : "text-sm")}>
          Desde {compare.nextStartsLabel}
          {compare.nextPhaseName ? ` pasa a ${compare.nextPhaseName}` : ""} (
          {compare.nextAmountLabel}).
        </p>
      ) : compare.nextAmountLabel && compare.nextStartsLabel ? (
        <p className={cn("text-ck-text-muted", compact ? "text-xs" : "text-sm")}>
          Próximo cambio: {compare.nextAmountLabel} desde {compare.nextStartsLabel}
          {compare.nextPhaseName ? ` (${compare.nextPhaseName})` : ""}.
        </p>
      ) : null}
      {!compact ? (
        <p className="text-xs leading-relaxed text-ck-text-muted">{compare.helper}</p>
      ) : null}
    </div>
  );
}
