import type { Metadata } from "next";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { aboutPageContent } from "@/content/about";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = aboutPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.about,
});

export default function AboutPage() {
  return (
    <>
      <SimpleBreadcrumb current="Nosotros" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
      />

      <Section>
        <Container className="max-w-3xl space-y-6">
          {content.story.map((paragraph) => (
            <p key={paragraph} className="ck-body-lg text-ck-text-secondary">
              {paragraph}
            </p>
          ))}
          <Card variant="yellow" className="mt-4">
            <p className="ck-body-md text-ck-text-secondary">{content.respect}</p>
          </Card>
        </Container>
      </Section>

      <Section tone="muted">
        <Container>
          <h2 className="ck-heading-lg">Pendiente de aprobación editorial</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {content.pending.map((item) => (
              <li key={item}>
                <Badge variant="neutral">{item}</Badge>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
