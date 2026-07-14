import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { homeContent } from "@/content/home";

export function VenueProgramSection() {
  const { venues } = homeContent;

  return (
    <Section id={venues.id} aria-labelledby="venues-title">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <div>
          <SectionHeader
            eyebrow={venues.eyebrow}
            title={venues.title}
            description={venues.lead}
            titleId="venues-title"
          />
          <p className="ck-body-md mt-6 max-w-prose text-ck-text-secondary">{venues.body}</p>
          <div className="mt-8 flex flex-col items-start gap-2">
            <Button href={venues.cta.href} variant="outline">
              {venues.cta.label}
            </Button>
            <p className="ck-caption">{venues.cta.note}</p>
          </div>
        </div>

        <Card variant="yellow" className="h-fit">
          <p className="ck-label text-ck-black/70">Orientado a</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {venues.audience.map((item) => (
              <li key={item}>
                <Badge variant="brand">{item}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </Container>
    </Section>
  );
}
