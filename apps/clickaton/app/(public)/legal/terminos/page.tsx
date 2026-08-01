import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { clickatonLegalFunnelContent } from "@/content/legal-funnel";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Términos y condiciones",
  description: "Bases y condiciones de participación e inscripción en Clickatón.",
  path: "/legal/terminos",
  noIndex: true,
});

export default function TermsPage() {
  const {
    termsSections,
    termsVersion,
    legalReviewRequired,
    publicationStatus,
  } = clickatonLegalFunnelContent;

  return (
    <Section>
      <Container className="prose prose-invert max-w-3xl space-y-8 py-12">
        <header className="space-y-3">
          <h1>Bases y condiciones</h1>
          <p className="text-sm text-ck-text-muted">
            Versión {termsVersion}
            {legalReviewRequired
              ? " · Pendiente de validación jurídica antes del go-live comercial."
              : ` · ${publicationStatus} · Aprobadas para inscripción`}
          </p>
        </header>
        {termsSections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </Container>
    </Section>
  );
}
