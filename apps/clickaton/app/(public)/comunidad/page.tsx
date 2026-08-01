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

      <Section
        tone="raised"
        aria-labelledby="community-audience-title"
        className="relative overflow-hidden"
      >
        {/* Fondo fotográfico a baja opacidad (sin recuadros) */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.audienceBackground.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-[0.22]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-city-photographer.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[70%_40%] opacity-[0.12] mix-blend-lighten"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_10_/_0.72)_0%,rgb(10_10_10_/_0.82)_55%,rgb(10_10_10_/_0.9)_100%)]" />
        </div>

        <Container className="relative z-[1] max-w-3xl">
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
          <div className="mt-[var(--ck-stack-content-to-actions)]">
            <Button
              href={content.whatsapp.href}
              variant="primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {content.whatsapp.label}
            </Button>
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
