import type { Metadata } from "next";
import { AudienceGrid } from "@/components/content/AudienceGrid";
import { PageHero } from "@/components/content/PageHero";
import { PhotoFrame } from "@/components/content/PhotoFrame";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sponsorsPageContent } from "@/content/sponsors";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = sponsorsPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.sponsors,
});

export default function SponsorsPage() {
  return (
    <>
      <SimpleBreadcrumb current="Sponsors" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
        actions={
          <Button href={routes.contact} variant="secondary">
            Quiero acompañar el proyecto
          </Button>
        }
      />

      <Section tone="muted">
        <Container>
          <SectionHeader
            eyebrow="Visión"
            title="Por qué acompañar Clickatón"
            titleId="sponsors-why"
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {content.why.map((item) => (
              <li key={item}>
                <Card className="h-full">
                  <p className="ck-body-sm text-ck-text-secondary">{item}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Rubros" title="Posibles aliados" titleId="sponsors-sectors" />
          <div className="mt-6">
            <AudienceGrid items={content.sectors} />
          </div>
          <PhotoFrame
            variant="sponsor-feature"
            alt="Activación de marca en experiencia Clickatón"
            overlay="medium"
            caption="Stands, premiación y presencia urbana — material futuro autorizado."
            className="mt-12 max-w-3xl"
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2">
            {content.opportunities.map((item) => (
              <li key={item.title}>
                <Card variant="outlined" className="h-full">
                  <h3 className="ck-heading-md">{item.title}</h3>
                  <p className="ck-body-sm mt-3 text-ck-text-secondary">{item.body}</p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="ck-body-sm mt-8 max-w-prose border-l-4 border-ck-yellow pl-4 text-ck-text-muted">
            {content.note}
          </p>
        </Container>
      </Section>
    </>
  );
}
