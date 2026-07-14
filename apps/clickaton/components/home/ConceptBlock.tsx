import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import { homeContent } from "@/content/home";

export function ConceptBlock() {
  const { concept } = homeContent;

  return (
    <Section id={concept.id} aria-labelledby="concept-title">
      <Container>
        <SectionHeader
          eyebrow="Concepto"
          title={concept.title}
          description={concept.lead}
          titleId="concept-title"
        />

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {concept.pillars.map((pillar, index) => (
            <li key={pillar.title}>
              <Card className="h-full border-t-4 border-t-ck-yellow" variant="default">
                <div className="flex items-center justify-between">
                  <p className="ck-label text-ck-text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <FocusMark className="text-ck-black/50" size="sm" />
                </div>
                <h3 className="ck-heading-md mt-3">{pillar.title}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{pillar.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
