import type { Metadata } from "next";
import { AudienceGrid } from "@/components/content/AudienceGrid";
import { PageHero } from "@/components/content/PageHero";
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

      <Section tone="muted" aria-labelledby="community-audience-title">
        <Container>
          <SectionHeader
            eyebrow="Quiénes forman parte"
            title="Una comunidad amplia y diversa"
            titleId="community-audience-title"
          />
          <div className="mt-8">
            <AudienceGrid items={content.audiences} variant="brand" />
          </div>
          <p className="ck-body-md mt-8 max-w-prose text-ck-text-secondary">{content.future}</p>
        </Container>
      </Section>

      <Section aria-labelledby="community-values-title">
        <Container>
          <SectionHeader
            eyebrow="Valores"
            title="Cómo queremos convivir"
            titleId="community-values-title"
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
