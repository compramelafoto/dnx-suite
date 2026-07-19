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
          align="center"
          eyebrow={howItWorks.eyebrow}
          title={howItWorks.title}
          description={howItWorks.lead}
          titleId="how-title"
          action={<Badge variant="neutral">{howItWorks.note}</Badge>}
        />

        <ol className="mt-[var(--ck-stack-subtitle-to-content)] grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title}>
              <Card variant="interactive" className="flex h-full flex-col gap-4">
                <IconFrame tone="dark" className="size-10 shrink-0" label={`Paso ${index + 1}`}>
                  <span className="font-display text-lg leading-none text-ck-yellow">
                    {index + 1}
                  </span>
                </IconFrame>
                <div className="min-w-0 space-y-3">
                  <h3 className="ck-heading-md">{step.title}</h3>
                  <p className="ck-body-sm text-ck-text-secondary">{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
