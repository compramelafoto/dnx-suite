import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import { IconFrame } from "@/components/ui/IconFrame";
import { homeContent } from "@/content/home";

export function HowItWorks() {
  const { howItWorks } = homeContent;

  return (
    <Section id={howItWorks.id} aria-labelledby="how-title">
      <Container>
        <SectionHeader
          eyebrow="Recorrido"
          title={howItWorks.title}
          description={howItWorks.lead}
          titleId="how-title"
        />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title}>
              <Card variant="interactive" className="relative h-full pt-8">
                <IconFrame
                  tone="dark"
                  className="absolute -top-3 left-5 size-8 text-sm"
                  label={`Paso ${index + 1}`}
                >
                  <span className="ck-display font-bold text-ck-yellow">{index + 1}</span>
                </IconFrame>
                <h3 className="ck-heading-md">{step.title}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
