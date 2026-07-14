import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { MarathonStatusBadges } from "@/components/marathon/MarathonStatusBadges";
import { formatMarathonDateRange, formatMarathonDateTime } from "@/lib/datetime";
import { canShowRegistrationCta, marathonLocationLabel } from "@/lib/marathons";
import { routes } from "@/config/navigation";
import type { PublicMarathon } from "@/types/marathon";
import { marathonFormatLabels } from "@/types/marathon";

type MarathonHeroProps = {
  marathon: PublicMarathon;
};

export function MarathonHero({ marathon }: MarathonHeroProps) {
  const showRegister = canShowRegistrationCta(marathon);

  return (
    <Section
      tone="yellow"
      grain
      className="relative overflow-hidden border-b-2 border-ck-border-strong"
      aria-labelledby="marathon-title"
    >
      <CoordinateGrid className="opacity-[0.07]" />
      <Container className="relative z-[2] max-w-4xl">
        <MarathonStatusBadges
          status={marathon.status}
          registrationStatus={marathon.registrationStatus}
        />
        <p className="ck-label mt-5 text-ck-text-secondary">{marathon.editionName}</p>
        <h1 id="marathon-title" className="ck-display-lg mt-3 text-ck-black">
          {marathon.name}
        </h1>
        <p className="ck-body-lg mt-5 max-w-prose text-ck-gray-700">
          {marathon.shortDescription}
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="ck-label text-ck-black/60">Territorio</dt>
            <dd className="ck-heading-md mt-2">{marathonLocationLabel(marathon)}</dd>
          </div>
          <div>
            <dt className="ck-label text-ck-black/60">Fechas</dt>
            <dd className="ck-heading-md mt-2">
              {formatMarathonDateRange(marathon.startAt, marathon.endAt, marathon.timezone)}
            </dd>
          </div>
          <div>
            <dt className="ck-label text-ck-black/60">Formato</dt>
            <dd className="ck-heading-md mt-2">{marathonFormatLabels[marathon.format]}</dd>
          </div>
          <div>
            <dt className="ck-label text-ck-black/60">Modalidad</dt>
            <dd className="ck-heading-md mt-2">{marathon.modality}</dd>
          </div>
        </dl>

        {marathon.registrationOpenAt ? (
          <p className="ck-caption mt-6 text-ck-gray-700">
            Inscripción prevista desde{" "}
            {formatMarathonDateTime(marathon.registrationOpenAt, marathon.timezone)}
            {marathon.registrationCloseAt
              ? ` hasta ${formatMarathonDateTime(marathon.registrationCloseAt, marathon.timezone)}`
              : null}
            .
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {showRegister ? (
            <Button disabled aria-disabled="true">
              Inscripción (próximamente)
            </Button>
          ) : (
            <Button disabled aria-disabled="true">
              Inscripción no disponible
            </Button>
          )}
          <Button href={routes.howItWorks} variant="outline">
            Cómo funciona
          </Button>
          <Button href={routes.marathons} variant="ghost">
            Volver a maratones
          </Button>
        </div>
      </Container>
    </Section>
  );
}
