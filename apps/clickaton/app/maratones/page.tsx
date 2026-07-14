import type { Metadata } from "next";
import { EmptyMarathonsState } from "@/components/content/EmptyMarathonsState";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { marathonsPageContent } from "@/content/marathons";
import { buildPageMetadata } from "@/lib/seo";
import { routes } from "@/config/navigation";

const content = marathonsPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.marathons,
});

export default function MarathonsPage() {
  return (
    <>
      <SimpleBreadcrumb current="Maratones" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
        actions={
          <>
            <Button href={content.ctas.howItWorks.href}>{content.ctas.howItWorks.label}</Button>
            <Button href={content.ctas.organize.href} variant="outline">
              {content.ctas.organize.label}
            </Button>
          </>
        }
      />

      <Section tone="muted" aria-labelledby="empty-marathons-title">
        <Container>
          <h2 id="empty-marathons-title" className="sr-only">
            Estado de próximas maratones
          </h2>
          <EmptyMarathonsState
            message={content.empty.message}
            note={content.empty.note}
            formats={content.empty.formats}
            registrationStatuses={content.empty.registrationStatuses}
            cardHints={content.empty.cardHints}
          />
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-6">
          <Card variant="yellow">
            <h2 className="ck-heading-lg">{content.notes.title}</h2>
            <p className="ck-body-md mt-4 text-ck-gray-700">{content.notes.body}</p>
          </Card>
          <Card variant="outlined">
            <h2 className="ck-heading-md">Vista técnica</h2>
            <p className="ck-body-sm mt-3 text-ck-text-secondary">{content.demo.note}</p>
            <div className="mt-5">
              <Button href={content.demo.href} variant="outline">
                {content.demo.label}
              </Button>
            </div>
          </Card>
        </Container>
      </Section>
    </>
  );
}
