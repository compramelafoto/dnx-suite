import type { ReactNode } from "react";
import type { ChecklistItem, PresentedStatus } from "../../lib/fotorank/public-ux/participant-status";
import { PageHeader } from "./PageHeader";
import { ProgressChecklist } from "./ProgressChecklist";
import { StatusBadge } from "./StatusBadge";
import { InfoCard } from "./InfoCard";
import { Notice } from "./Notice";

type Props = {
  contestTitle: string;
  participantLabel?: string | null;
  registrationStatus: PresentedStatus;
  artworkStatus: PresentedStatus;
  categoryName?: string | null;
  registrationNumber?: string | null;
  relevantDateLabel?: string | null;
  checklist: ChecklistItem[];
  primaryAction?: ReactNode;
  notice?: ReactNode;
  artworks?: ReactNode;
};

/**
 * Simple participant dashboard — answers “¿mi participación está bien y qué hago ahora?”
 */
export function ParticipantDashboard({
  contestTitle,
  participantLabel,
  registrationStatus,
  artworkStatus,
  categoryName,
  registrationNumber,
  relevantDateLabel,
  checklist,
  primaryAction,
  notice,
  artworks,
}: Props) {
  return (
    <div className="flex flex-col gap-10 md:gap-12" data-testid="participant-dashboard">
      <PageHeader
        eyebrow="Tu participación"
        title={contestTitle}
        description={
          participantLabel
            ? `${participantLabel}. ${registrationStatus.description}`
            : registrationStatus.description
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <StatusBadge
              label={registrationStatus.label}
              tone={registrationStatus.tone}
              stateText="Estado de inscripción"
            />
            {relevantDateLabel ? (
              <p className="text-sm text-[var(--foreground-muted)]">{relevantDateLabel}</p>
            ) : null}
            {primaryAction}
          </div>
        }
      />

      {notice}

      <section aria-labelledby="participation-summary-title">
        <h2 id="participation-summary-title" className="fr-public-title text-xl md:text-2xl">
          Resumen
        </h2>
        <div className="fr-public-stack-content fr-public-card-grid sm:grid-cols-2">
          {registrationNumber ? (
            <InfoCard label="Número de inscripción" value={registrationNumber} accent />
          ) : null}
          {categoryName ? <InfoCard label="Categoría" value={categoryName} /> : null}
          <InfoCard
            label="Inscripción"
            value={registrationStatus.label}
            hint={registrationStatus.description}
          />
          <InfoCard
            label="Fotografía"
            value={artworkStatus.label}
            hint={artworkStatus.description}
          />
        </div>
      </section>

      <ProgressChecklist items={checklist} />

      {artworks ? (
        <section aria-labelledby="artworks-title" className="space-y-6">
          <h2 id="artworks-title" className="fr-public-title text-xl md:text-2xl">
            Tus fotografías
          </h2>
          {artworks}
        </section>
      ) : null}

      {!artworkStatus.nextAction && artworkStatus.tone === "neutral" ? (
        <Notice tone="info" title="Próximo paso">
          {artworkStatus.description}
        </Notice>
      ) : null}
    </div>
  );
}
