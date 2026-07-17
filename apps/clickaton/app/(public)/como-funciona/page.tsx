import type { Metadata } from "next";
import { PageHero } from "@/components/content/PageHero";
import { ProcessTimeline } from "@/components/content/ProcessTimeline";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import { howItWorksPageContent } from "@/content/how-it-works";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = howItWorksPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.howItWorks,
});

export default function HowItWorksPage() {
  return (
    <>
      <SimpleBreadcrumb current="Cómo funciona" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
      />

      <Section tone="muted">
        <Container>
          <p className="ck-body-sm max-w-[var(--ck-content-readable)] border-l-4 border-ck-yellow pl-4 text-ck-text-muted">
            {content.disclaimer}
          </p>
          <div className="mt-12">
            <SectionHeader
              eyebrow="Recorrido"
              title="De la inscripción a la comunidad"
              titleId="how-phases-title"
            />
            <div className="mt-10">
              <ProcessTimeline steps={content.phases} />
            </div>
          </div>
        </Container>
      </Section>

      <Section aria-labelledby="how-faq-title">
        <Container className="max-w-3xl">
          <h2 id="how-faq-title" className="ck-display-md">
            Preguntas clave
          </h2>
          <div className="mt-8 space-y-4">
            {content.faq.map((item) => (
              <Card key={item.question}>
                <h3 className="ck-heading-md">{item.question}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{item.answer}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
