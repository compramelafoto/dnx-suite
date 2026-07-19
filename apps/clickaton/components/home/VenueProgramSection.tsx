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
      <Container className="mx-auto max-w-3xl text-center">
        <SectionHeader
          align="center"
          eyebrow={venues.eyebrow}
          title={venues.title}
          description={venues.lead}
          titleId="venues-title"
        />
        <p className="ck-body-md mx-auto mt-6 max-w-prose text-ck-text-secondary">
          {venues.body}
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button href={venues.cta.href} variant="secondary">
            {venues.cta.label}
          </Button>
          <p className="ck-caption">{venues.cta.note}</p>
        </div>
        <Card variant="yellow" className="mx-auto mt-8 max-w-2xl">
          <p className="ck-label text-ck-yellow">Orientado a</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
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
