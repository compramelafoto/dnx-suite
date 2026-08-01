import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { MarathonStatusBadges } from "@/components/marathon/MarathonStatusBadges";
import { formatMarathonDateRange, formatMarathonDateTime } from "@/lib/datetime";
import { marathonLocationLabel } from "@/lib/marathons";
import { presentRegistrationCta } from "@/lib/registration-cta";
import { routes } from "@/config/navigation";
import type { PublicMarathon } from "@/types/marathon";
import { marathonFormatLabels } from "@/types/marathon";
import type { PublicMarathonCapabilities } from "@/types/public";

type MarathonHeroProps = {
  marathon: PublicMarathon;
  capabilities?: PublicMarathonCapabilities | null;
  /** Oferta nativa 10D3F cuando hay edición Prisma publicada con entradas. */
  nativeRegistrationHref?: string | null;
  nativeRegistrationLabel?: string | null;
};

export function MarathonHero({
  marathon,
  capabilities = null,
  nativeRegistrationHref = null,
  nativeRegistrationLabel = null,
}: MarathonHeroProps) {
  const reg = presentRegistrationCta(marathon.registration, {
    nativeHref: nativeRegistrationHref,
    nativeLabel: nativeRegistrationLabel,
  });
  const showResults =
    marathon.status === "results_published" ||
    marathon.resultsStatus === "published";

  return (
    <Section
      tone="dark"
      grain
      className="ck-vignette relative overflow-hidden border-b border-ck-border"
      aria-labelledby="marathon-title"
    >
      <CoordinateGrid className="opacity-[0.04]" />
      <Container className="relative z-[2] grid gap-10 py-6 md:py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-12">
        <div>
          <MarathonStatusBadges
            status={marathon.status}
            registrationStatus={marathon.registrationStatus}
          />
          <p className="ck-label mt-6 text-ck-yellow">{marathon.editionName}</p>
          <h1 id="marathon-title" className="ck-display-lg mt-3 text-ck-text">
            {marathon.name}
          </h1>
          <p className="ck-body-lg mt-6 max-w-prose text-ck-text-secondary">
            {marathon.shortDescription}
          </p>

          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="ck-label text-ck-text-muted">Territorio</dt>
              <dd className="ck-heading-md mt-2 text-ck-text">
                {marathonLocationLabel(marathon)}
              </dd>
            </div>
            <div>
              <dt className="ck-label text-ck-text-muted">Fechas</dt>
              <dd className="ck-heading-md mt-2 text-ck-text">
                {formatMarathonDateRange(marathon.startAt, marathon.endAt, marathon.timezone)}
              </dd>
            </div>
            <div>
              <dt className="ck-label text-ck-text-muted">Formato</dt>
              <dd className="ck-heading-md mt-2 text-ck-text">
                {marathonFormatLabels[marathon.format]}
              </dd>
            </div>
            <div>
              <dt className="ck-label text-ck-text-muted">Inscripción</dt>
              <dd className="ck-heading-md mt-2 text-ck-text">{reg.headline}</dd>
              {reg.secondaryLine ? (
                <dd className="ck-body-sm mt-2 text-ck-text-secondary">{reg.secondaryLine}</dd>
              ) : null}
            </div>
          </dl>

          {marathon.registration?.opensAt || marathon.registrationOpenAt ? (
            <p className="ck-caption mt-8 text-ck-text-muted">
              Inscripción prevista desde{" "}
              {formatMarathonDateTime(
                marathon.registration?.opensAt ?? marathon.registrationOpenAt!,
                marathon.timezone,
              )}
              {marathon.registration?.closesAt || marathon.registrationCloseAt
                ? ` hasta ${formatMarathonDateTime(
                    marathon.registration?.closesAt ?? marathon.registrationCloseAt!,
                    marathon.timezone,
                  )}`
                : null}
              .
            </p>
          ) : null}

          {marathon.registration?.capacity != null ? (
            <p className="ck-caption mt-3 text-ck-text-muted">
              Cupo: {marathon.registration.capacity}
              {marathon.registration.remainingSpots != null
                ? ` · Quedan ${marathon.registration.remainingSpots}`
                : null}
            </p>
          ) : null}

          {marathon.registration?.hasOptionalMerchandise ? (
            <p className="ck-body-sm mt-6 max-w-prose text-ck-text-secondary">
              Durante la inscripción vas a poder sumar productos oficiales de Clickatón de
              manera opcional.
            </p>
          ) : null}

          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            {reg.ctaEnabled && reg.ctaHref && reg.ctaLabel ? (
              <Button href={reg.ctaHref} className="w-full sm:w-auto">
                {reg.ctaLabel}
              </Button>
            ) : (
              <Button disabled aria-disabled="true" className="w-full sm:w-auto">
                {reg.headline}
              </Button>
            )}
            {showResults && capabilities?.canViewResults ? (
              <Button href="#resultados" variant="secondary" className="w-full sm:w-auto">
                Ver resultados
              </Button>
            ) : null}
            <Button href={routes.howItWorks} variant="secondary" className="w-full sm:w-auto">
              Cómo funciona
            </Button>
            <Button href={routes.marathons} variant="ghost" className="w-full sm:w-auto">
              Volver a maratones
            </Button>
          </div>
        </div>

        <PhotoFrame
          variant="hero"
          src={marathon.coverImageVertical || marathon.coverImage}
          alt={`Portada de ${marathon.name}`}
          credit={marathon.coverImageCredit}
          overlay="medium"
          caption={marathon.city}
          priority
          className="!aspect-[9/16] max-h-[min(78vh,42rem)] lg:sticky lg:top-28 lg:max-h-none"
        />
      </Container>
    </Section>
  );
}
