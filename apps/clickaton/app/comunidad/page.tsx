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
import { communityPageContent } from "@/content/community";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = communityPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.community,
});

export default function CommunityPage() {
  return (
    <>
      <SimpleBreadcrumb current="Comunidad" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
        actions={<Button href={routes.marathons}>Ver maratones</Button>}
      />

      <Section tone="raised" aria-labelledby="community-audience-title">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-12">
          <div>
            <SectionHeader
              eyebrow="Quiénes forman parte"
              title="Una comunidad amplia y diversa"
              titleId="community-audience-title"
            />
            <div className="mt-[var(--ck-stack-subtitle-to-content)]">
              <AudienceGrid items={content.audiences} variant="brand" />
            </div>
            <p className="ck-body-md mt-[var(--ck-stack-block)] max-w-prose text-ck-text-secondary">
              {content.future}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <PhotoFrame
              variant="editorial"
              alt="Recorrido urbano de la comunidad Clickatón"
              overlay="soft"
              className="col-span-2"
            />
            <PhotoFrame variant="portrait" alt="Participante fotografiando en la calle" overlay="soft" />
            <PhotoFrame variant="portrait" alt="Intercambio y revisión entre participantes" overlay="soft" />
          </div>
        </Container>
      </Section>

      <Section aria-labelledby="community-values-title">
        <Container>
          <SectionHeader
            eyebrow="Valores"
            title="Cómo queremos convivir"
            titleId="community-values-title"
          />
          <ul className="mt-[var(--ck-stack-subtitle-to-content)] grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.values.map((value) => (
              <li key={value.title}>
                <Card className="h-full">
                  <h3 className="ck-heading-md">{value.title}</h3>
                  <p className="ck-body-sm mt-3 text-ck-text-secondary">{value.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
