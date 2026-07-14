import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconFrame } from "@/components/ui/IconFrame";
import { homeContent } from "@/content/home";

export function ExperienceSteps() {
  const { howItWorks } = homeContent;

  return (
    <Section id={howItWorks.id} aria-labelledby="how-title">
      <Container>
        <SectionHeader
          eyebrow={howItWorks.eyebrow}
          title={howItWorks.title}
          description={howItWorks.lead}
          titleId="how-title"
          action={<Badge variant="neutral">{howItWorks.note}</Badge>}
        />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title}>
              <Card variant="interactive" className="relative h-full pt-8">
                <IconFrame
                  tone="dark"
                  className="absolute -top-3 left-5 size-8"
                  label={`Paso ${index + 1}`}
                >
                  <span className="ck-display text-sm font-bold text-ck-yellow">
                    {index + 1}
                  </span>
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
