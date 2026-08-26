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
  heroImageMobileUrl?: string | null;
  /** overlay = imagen de fondo con texto encima; stacked = banner sin tapar logos + copy debajo */
  layout?: "overlay" | "stacked";
  objectPosition?: string;
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
  heroImageMobileUrl,
  layout = "overlay",
  objectPosition = "50% 50%",
  visibilityNote,
  primaryAction,
  secondaryAction,
}: Props) {
  const copy = (
    <div className="fr-public-hero-copy max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={phaseLabel} tone={phaseTone} stateText="Estado del concurso" />
        {editionLabel ? <StatusBadge label={editionLabel} tone="neutral" /> : null}
        {visibilityNote ? <StatusBadge label={visibilityNote} tone="neutral" /> : null}
      </div>

      <div className="fr-public-stack-content flex flex-wrap items-center gap-4">
        {organizerLogoUrl && layout !== "stacked" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organizerLogoUrl}
            alt=""
            className="h-12 w-auto max-w-[140px] object-contain md:h-14"
          />
        ) : null}
        <p className="text-sm leading-relaxed text-[var(--foreground-muted)] md:text-base">
          Organiza{" "}
          <span className="font-semibold text-[var(--foreground)]">{organizerName}</span>
        </p>
      </div>

      <h1 className="fr-public-title fr-public-stack-content text-3xl md:text-5xl lg:text-[3.5rem]">
        {title}
      </h1>
      {summary ? (
        <p className="fr-public-body fr-public-stack-title max-w-2xl text-lg md:text-xl">{summary}</p>
      ) : null}
      {deadlineLabel ? (
        <p className="fr-public-stack-title text-sm leading-relaxed text-[var(--foreground-muted)] md:text-base">
          Cierre de inscripción:{" "}
          <strong className="font-semibold text-[var(--foreground)]">{deadlineLabel}</strong>
        </p>
      ) : null}

      <div className="fr-public-stack-actions flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );

  if (layout === "stacked" && heroImageUrl) {
    return (
      <section className="fr-public-hero fr-public-hero--stacked" data-testid="contest-hero">
        <div className="fr-public-hero__banner" style={{ background: "var(--background)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt=""
            className="fr-public-hero__media fr-public-hero__media--desktop"
            style={{ objectPosition }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageMobileUrl || heroImageUrl}
            alt=""
            className="fr-public-hero__media fr-public-hero__media--mobile"
            style={{ objectPosition }}
          />
        </div>
        <PageContainer className="relative z-10 pb-12 pt-8 md:pb-16 md:pt-10">{copy}</PageContainer>
      </section>
    );
  }

  return (
    <section className="relative min-h-[70vh] overflow-hidden md:min-h-[76vh]" data-testid="contest-hero">
      {heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- contest-configured URLs
        <img
          src={heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      ) : (
        <div className="absolute inset-0 bg-[var(--surface-secondary)]" aria-hidden />
      )}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_0%,rgb(20_20_20_/_0.85)_45%,rgb(20_20_20_/_0.4)_100%)]"
        aria-hidden
      />
      <PageContainer className="relative z-10 flex min-h-[70vh] flex-col justify-end pb-16 pt-28 md:min-h-[76vh] md:pb-24 md:pt-32">
        {copy}
      </PageContainer>
    </section>
  );
}
