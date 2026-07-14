import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import {
  organizerTypeLabels,
  type PublicMarathon,
} from "@/types/marathon";

type MarathonOrganizerProps = {
  marathon: PublicMarathon;
};

export function MarathonOrganizer({ marathon }: MarathonOrganizerProps) {
  const { organizer, localVenue, contactInfo } = marathon;

  return (
    <Section tone="muted" aria-labelledby="marathon-org-title">
      <Container>
        <SectionHeader
          eyebrow="Organización"
          title="Quién produce esta edición"
          titleId="marathon-org-title"
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card className="h-full">
            <p className="ck-label text-ck-text-muted">
              {organizerTypeLabels[organizer.type]}
            </p>
            <h3 className="ck-heading-lg mt-3">{organizer.name}</h3>
            {organizer.description ? (
              <p className="ck-body-md mt-4 text-ck-text-secondary">{organizer.description}</p>
            ) : null}
            {(organizer.city || organizer.country) && (
              <p className="ck-caption mt-4 text-ck-text-muted">
                {[organizer.city, organizer.country].filter(Boolean).join(", ")}
              </p>
            )}
          </Card>

          {localVenue ? (
            <Card className="h-full" variant="outlined">
              <p className="ck-label text-ck-text-muted">Sede local</p>
              <h3 className="ck-heading-lg mt-3">{localVenue.name}</h3>
              <p className="ck-body-sm mt-3 text-ck-text-muted">
                {[localVenue.city, localVenue.provinceOrRegion, localVenue.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {localVenue.coordinatorName ? (
                <p className="ck-body-sm mt-3">
                  Coordinación: {localVenue.coordinatorName}
                </p>
              ) : null}
              {localVenue.description ? (
                <p className="ck-body-md mt-4 text-ck-text-secondary">
                  {localVenue.description}
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
        {contactInfo ? (
          <p className="ck-body-sm mt-8 max-w-prose text-ck-text-muted">{contactInfo}</p>
        ) : null}
      </Container>
    </Section>
  );
}
