import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { homeContent } from "@/content/home";

/**
 * Placeholder editorial para el futuro listado de eventos (FotoRank).
 * Sin recuadros de foto ni ciudades/fechas inventadas.
 */
export function UpcomingEventsPlaceholder() {
  const { upcoming } = homeContent;

  return (
    <Section id={upcoming.id} tone="raised" aria-labelledby="upcoming-title">
      <Container className="mx-auto max-w-3xl text-center">
        <SectionHeader
          align="center"
          eyebrow={upcoming.eyebrow}
          title={upcoming.title}
          titleId="upcoming-title"
          action={<Badge variant="brand">{upcoming.status}</Badge>}
        />

        <div className="mt-10 space-y-4">
          <div className="flex justify-center">
            <EditorialLabel>Agenda en preparación</EditorialLabel>
          </div>
          <p className="ck-heading-lg mx-auto max-w-xl">{upcoming.message}</p>
          <p className="ck-body-sm mx-auto max-w-prose text-ck-text-muted">
            {upcoming.note}
          </p>
          <div className="flex justify-center pt-2">
            <Button href={upcoming.cta.href} variant="secondary">
              {upcoming.cta.label}
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
