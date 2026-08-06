import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import type { StatusTone } from "../../lib/fotorank/public-ux/participant-status";

type Props = {
  title?: string | null;
  categoryName?: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  dateLabel?: string | null;
  observation?: string | null;
  previewUrl?: string | null;
  action?: ReactNode;
};

export function ParticipantArtworkCard({
  title,
  categoryName,
  statusLabel,
  statusTone,
  dateLabel,
  observation,
  previewUrl,
  action,
}: Props) {
  return (
    <article className="fr-public-card" data-testid="participant-artwork-card">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-secondary)] sm:w-40 sm:shrink-0">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed preview URLs
            <img src={previewUrl} alt={title ? `Vista previa de ${title}` : "Vista previa de la obra"} className="aspect-square h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center p-4 text-center text-sm text-[var(--foreground-muted)]">
              Sin vista previa
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={statusLabel} tone={statusTone} stateText="Estado de la obra" />
            {categoryName ? (
              <span className="text-sm text-[var(--foreground-muted)]">{categoryName}</span>
            ) : null}
          </div>
          {title ? <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3> : null}
          {dateLabel ? <p className="text-sm text-[var(--foreground-muted)]">{dateLabel}</p> : null}
          {observation ? (
            <p className="rounded-[var(--radius-md)] border border-[rgb(251_191_36_/_0.35)] bg-[var(--warning-soft)] p-3 text-sm text-[var(--foreground)]">
              {observation}
            </p>
          ) : null}
          {action ? <div className="pt-2">{action}</div> : null}
        </div>
      </div>
    </article>
  );
}
