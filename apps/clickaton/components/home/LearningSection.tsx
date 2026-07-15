import { BrushStroke } from "@/components/brand/BrushStroke";
import { PhotoFrame } from "@/components/content/PhotoFrame";
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
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-end lg:gap-14">
          <SectionHeader
            eyebrow={learning.eyebrow}
            title={learning.title}
            description={learning.lead}
            titleId="learning-title"
          />
          <PhotoFrame
            variant="editorial"
            alt="Momento de revisión y aprendizaje fotográfico"
            overlay="soft"
            className="max-w-xl lg:justify-self-end"
          />
        </div>
        <BrushStroke className="mt-6" />

        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {learning.points.map((point) => (
            <li key={point.title}>
              <Card className="h-full">
                <h3 className="ck-heading-md">{point.title}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{point.body}</p>
              </Card>
            </li>
          ))}
        </ul>

        <p className="ck-body-sm mt-8 max-w-[var(--ck-content-readable)] border-l-4 border-ck-yellow pl-4 text-ck-text-muted">
          {learning.disclaimer}
        </p>
      </Container>
    </Section>
  );
}
