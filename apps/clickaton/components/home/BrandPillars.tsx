import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import { homeContent } from "@/content/home";

const marks = ["01", "02", "03", "04"] as const;

export function BrandPillars() {
  const { pillars } = homeContent;

  return (
    <Section id={pillars.id} tone="raised" aria-labelledby="pillars-title">
      <Container>
        <SectionHeader
          align="center"
          eyebrow={pillars.eyebrow}
          title={pillars.title}
          titleId="pillars-title"
        />

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {pillars.items.map((item, index) => (
            <li key={item.title}>
              <Card className="relative h-full overflow-hidden border-t-4 border-t-ck-yellow">
                <div className="mb-4 flex items-center justify-between">
                  <span className="ck-mono text-ck-text-muted">{marks[index]}</span>
                  <FocusMark size="sm" className="text-ck-yellow/50" />
                </div>
                <h3 className="ck-heading-md">{item.title}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{item.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
