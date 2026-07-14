import type { Metadata } from "next";
import { AudienceGrid } from "@/components/content/AudienceGrid";
import { PageHero } from "@/components/content/PageHero";
import { ProcessTimeline } from "@/components/content/ProcessTimeline";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { organizePageContent } from "@/content/organize";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = organizePageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.organize,
});

export default function OrganizePage() {
  return (
    <>
      <SimpleBreadcrumb current="Organizá una" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
        actions={
          <Button href={routes.contact} variant="outline">
            Ir a contacto
          </Button>
        }
      />

      <Section tone="muted">
        <Container>
          <Badge variant="warning">Programa en desarrollo</Badge>
          <p className="ck-body-lg mt-4 max-w-prose text-ck-text-secondary">{content.status}</p>
          <div className="mt-10">
            <SectionHeader eyebrow="Público" title="¿Para quién es?" titleId="organize-audience" />
            <div className="mt-6">
              <AudienceGrid items={content.audience} variant="brand" />
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="ck-heading-lg">Qué aporta el equipo local</h2>
            <ul className="mt-4 space-y-2">
              {content.localContributes.map((item) => (
                <li key={item} className="ck-body-sm text-ck-text-secondary">
                  · {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card variant="yellow">
            <h2 className="ck-heading-lg">Qué aporta Clickaton</h2>
            <ul className="mt-4 space-y-2">
              {content.clickatonContributes.map((item) => (
                <li key={item} className="ck-body-sm text-ck-gray-700">
                  · {item}
                </li>
              ))}
            </ul>
          </Card>
        </Container>
      </Section>

      <Section tone="muted" aria-labelledby="organize-steps-title">
        <Container>
          <SectionHeader
            eyebrow="Camino"
            title="Etapas preliminares"
            titleId="organize-steps-title"
          />
          <div className="mt-10">
            <ProcessTimeline steps={content.steps} />
          </div>
          <p className="ck-body-sm mt-8 max-w-prose border-l-4 border-ck-yellow pl-4 text-ck-text-muted">
            {content.note}
          </p>
        </Container>
      </Section>
    </>
  );
}
