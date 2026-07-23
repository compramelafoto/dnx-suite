import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { clickatonLegalFunnelContent } from "@/content/legal-funnel";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Política de privacidad",
  description: "Cómo Clickatón trata los datos de inscripción y participación.",
  path: "/legal/privacidad",
  noIndex: true,
});

export default function PrivacyPage() {
  const { privacySections, privacyVersion, legalReviewRequired } =
    clickatonLegalFunnelContent;

  return (
    <Section>
      <Container className="prose prose-invert max-w-3xl space-y-8 py-12">
        <header className="space-y-3">
          <h1>Política de privacidad</h1>
          <p className="text-sm text-ck-text-muted">
            Versión {privacyVersion}
            {legalReviewRequired
              ? " · Pendiente de validación jurídica antes del go-live comercial."
              : null}
          </p>
        </header>
        {privacySections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </Container>
    </Section>
  );
}
