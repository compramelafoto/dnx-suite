import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { homeContent } from "@/content/home";

export function PartnershipSection() {
  const { partnerships } = homeContent;

  return (
    <Section id={partnerships.id} tone="muted" aria-labelledby="partners-title">
      <Container>
        <SectionHeader
          eyebrow={partnerships.eyebrow}
          title={partnerships.title}
          description={partnerships.lead}
          titleId="partners-title"
        />
        <p className="ck-body-md mt-4 max-w-[var(--ck-content-readable)] text-ck-text-secondary">
          {partnerships.body}
        </p>

        <Card variant="outlined" className="mt-10 border-dashed">
          <p className="ck-label text-ck-text-muted">Espacios de alianza posibles</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {partnerships.categories.map((category) => (
              <li key={category}>
                <Badge variant="neutral">{category}</Badge>
              </li>
            ))}
          </ul>
          <p className="ck-body-sm mt-6 text-ck-text-muted">
            Sin logos inventados. Sin precios. Una invitación a construir juntos.
          </p>
        </Card>

        <div className="mt-8 flex flex-col items-start gap-2">
          <Button href={partnerships.cta.href} variant="secondary">
            {partnerships.cta.label}
          </Button>
          <p className="ck-caption">{partnerships.cta.note}</p>
        </div>
      </Container>
    </Section>
  );
}
