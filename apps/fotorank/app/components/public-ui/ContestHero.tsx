import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import { PageContainer } from "./PageContainer";

type Props = {
  title: string;
  summary?: string | null;
  phaseLabel: string;
  phaseTone?: "primary" | "warning" | "neutral" | "success" | "danger";
  organizerName: string;
  organizerLogoUrl?: string | null;
  deadlineLabel?: string | null;
  editionLabel?: string | null;
  heroImageUrl?: string | null;
  visibilityNote?: string | null;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
};

export function ContestHero({
  title,
  summary,
  phaseLabel,
  phaseTone = "primary",
  organizerName,
  organizerLogoUrl,
  deadlineLabel,
  editionLabel,
  heroImageUrl,
  visibilityNote,
  primaryAction,
  secondaryAction,
}: Props) {
  return (
    <section className="relative min-h-[70vh] overflow-hidden md:min-h-[76vh]" data-testid="contest-hero">
      {heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- contest-configured URLs
        <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[var(--surface-secondary)]" aria-hidden />
      )}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_0%,rgb(20_20_20_/_0.85)_45%,rgb(20_20_20_/_0.4)_100%)]"
        aria-hidden
      />
      <PageContainer className="relative z-10 flex min-h-[70vh] flex-col justify-end pb-14 pt-28 md:min-h-[76vh] md:pb-20 md:pt-32">
        <div className="max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={phaseLabel} tone={phaseTone} stateText="Estado del concurso" />
            {editionLabel ? <StatusBadge label={editionLabel} tone="neutral" /> : null}
            {visibilityNote ? <StatusBadge label={visibilityNote} tone="neutral" /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {organizerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizerLogoUrl}
                alt=""
                className="h-12 w-auto max-w-[140px] object-contain md:h-14"
              />
            ) : null}
            <p className="text-sm text-[var(--foreground-muted)]">
              Organiza{" "}
              <span className="font-semibold text-[var(--foreground)]">{organizerName}</span>
            </p>
          </div>

          <h1 className="fr-public-title text-3xl md:text-5xl lg:text-[3.5rem]">{title}</h1>
          {summary ? <p className="fr-public-body max-w-2xl text-lg md:text-xl">{summary}</p> : null}
          {deadlineLabel ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              Cierre de inscripción:{" "}
              <strong className="font-semibold text-[var(--foreground)]">{deadlineLabel}</strong>
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
            {primaryAction}
            {secondaryAction}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
