import type { Metadata } from "next";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { contactPageContent } from "@/content/contact";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = contactPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.contact,
});

export default function ContactPage() {
  return (
    <>
      <SimpleBreadcrumb current="Contacto" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
      />

      <Section tone="muted">
        <Container className="max-w-3xl">
          <Card variant="outlined" className="border-dashed">
            <p className="ck-heading-md">{content.status}</p>
            <p className="ck-body-sm mt-3 text-ck-text-muted">{content.note}</p>
          </Card>

          <h2 className="ck-heading-lg mt-12">Motivos de contacto</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {content.reasons.map((reason) => (
              <li key={reason.title}>
                <Card className="h-full">
                  <h3 className="ck-heading-md">{reason.title}</h3>
                  <p className="ck-body-sm mt-3 text-ck-text-secondary">{reason.body}</p>
                </Card>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            {content.links.map((link) => (
              <Button key={link.href} href={link.href} variant="outline">
                {link.label}
              </Button>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
