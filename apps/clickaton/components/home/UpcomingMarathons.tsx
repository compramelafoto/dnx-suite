import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { homeContent } from "@/content/home";

export function UpcomingMarathons() {
  const { upcoming } = homeContent;

  return (
    <Section id={upcoming.id} tone="muted" aria-labelledby="upcoming-title">
      <Container>
        <SectionHeader
          eyebrow="Agenda"
          title={upcoming.title}
          titleId="upcoming-title"
          action={<Badge variant="brand">{upcoming.status}</Badge>}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((slot) => (
            <Card
              key={slot}
              as="article"
              variant="outlined"
              className="flex min-h-[12rem] flex-col justify-between border-dashed"
              aria-label={`Espacio reservado para maratón ${slot + 1}`}
            >
              <div className="space-y-3">
                <div className="h-3 w-24 rounded-[var(--ck-radius-sm)] bg-ck-gray-200" />
                <div className="h-6 w-3/4 rounded-[var(--ck-radius-sm)] bg-ck-gray-100" />
                <div className="h-3 w-1/2 rounded-[var(--ck-radius-sm)] bg-ck-gray-100" />
              </div>
              <p className="ck-label text-ck-text-muted">Próximamente</p>
            </Card>
          ))}
        </div>

        <div className="mt-8 max-w-[var(--ck-content-readable)] border-l-4 border-ck-yellow pl-4">
          <p className="ck-body-md text-ck-text">{upcoming.message}</p>
          <p className="ck-body-sm mt-2 text-ck-text-muted">{upcoming.note}</p>
        </div>
      </Container>
    </Section>
  );
}
