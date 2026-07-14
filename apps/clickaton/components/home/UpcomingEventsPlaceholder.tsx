import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import { homeContent } from "@/content/home";

/**
 * Placeholder visual para el futuro listado de eventos (FotoRank).
 * No inventa ciudades, fechas ni cupos.
 */
export function UpcomingEventsPlaceholder() {
  const { upcoming } = homeContent;

  return (
    <Section id={upcoming.id} tone="muted" aria-labelledby="upcoming-title">
      <Container>
        <SectionHeader
          eyebrow={upcoming.eyebrow}
          title={upcoming.title}
          titleId="upcoming-title"
          action={<Badge variant="brand">{upcoming.status}</Badge>}
        />

        <Card
          variant="outlined"
          className="mt-10 border-dashed bg-ck-white"
          aria-label="Espacio reservado para próximas maratones"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <EditorialLabel>Agenda en preparación</EditorialLabel>
              <p className="ck-heading-lg mt-4">{upcoming.message}</p>
              <p className="ck-body-sm mt-3 text-ck-text-muted">{upcoming.note}</p>
            </div>

            <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2 lg:w-auto">
              {[0, 1].map((slot) => (
                <div
                  key={slot}
                  className="flex min-h-[8.5rem] flex-col justify-between rounded-[var(--ck-radius-md)] border-2 border-dashed border-ck-gray-300 bg-ck-bg-alt p-4"
                  aria-hidden="true"
                >
                  <div className="space-y-2">
                    <div className="h-2.5 w-16 rounded-sm bg-ck-gray-200" />
                    <div className="h-5 w-28 rounded-sm bg-ck-gray-100" />
                    <div className="h-2.5 w-20 rounded-sm bg-ck-gray-100" />
                  </div>
                  <span className="ck-label flex items-center gap-2 text-ck-text-muted">
                    <FocusMark size="sm" />
                    Próximamente
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
