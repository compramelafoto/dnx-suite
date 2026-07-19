import { BrushStroke } from "@/components/brand/BrushStroke";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import { homeContent } from "@/content/home";

export function LearningSection() {
  const { learning } = homeContent;

  return (
    <Section id={learning.id} aria-labelledby="learning-title">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeader
            align="center"
            eyebrow={learning.eyebrow}
            title={learning.title}
            description={learning.lead}
            titleId="learning-title"
          />
          <BrushStroke className="mx-auto mt-6" />
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {learning.points.map((point) => (
            <li key={point.title}>
              <Card className="h-full text-center sm:text-left">
                <h3 className="ck-heading-md">{point.title}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{point.body}</p>
              </Card>
            </li>
          ))}
        </ul>

        <p className="ck-body-sm mx-auto mt-8 max-w-[var(--ck-content-readable)] border-l-4 border-ck-yellow pl-4 text-left text-ck-text-muted">
          {learning.disclaimer}
        </p>
      </Container>
    </Section>
  );
}
