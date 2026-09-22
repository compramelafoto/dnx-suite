import { prisma } from "@repo/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import {
  TestimonialSurveyForm,
  type TestimonialSurveyDefaults,
} from "@/components/testimonials/TestimonialSurveyForm";
import { routes } from "@/config/navigation";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import {
  ELIGIBILITY_DENIAL_COPY,
  resolveEligibility,
} from "@/lib/testimonials/domain/eligibility";
import { SURVEY_ASPECT_FIELDS } from "@/lib/testimonials/domain/survey-definition";
import { loadEligibilityFacts } from "@/lib/testimonials/infrastructure/prisma-eligibility";
import { testimonialRepository } from "@/lib/testimonials/infrastructure/prisma-testimonial-repository";
import { authorRoleLabel } from "@/lib/testimonials/public/voices-presentation";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "Contanos cómo te fue",
    description: "La encuesta de quienes participaron de Clickatón.",
    path: `/maratones/${slug}/testimonio`,
    // Es una página personal detrás de sesión: no tiene por qué indexarse.
    noIndex: true,
  });
}

const EMPTY_SCORES = Object.fromEntries(
  SURVEY_ASPECT_FIELDS.map((field) => [field, null]),
) as TestimonialSurveyDefaults["scores"];

export default async function TestimonialSurveyPage({ params }: PageProps) {
  const { slug } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      testimonialsEnabled: true,
      fotorankContestId: true,
    },
  });

  // Sin edición, o con el módulo apagado, la página no existe.
  if (!edition || !edition.testimonialsEnabled) notFound();

  const pathname = `/maratones/${edition.slug}/testimonio`;
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
  }

  const facts = await loadEligibilityFacts({
    userId: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    editionId: edition.id,
    fotorankContestId: edition.fotorankContestId,
  });
  const eligibility = resolveEligibility(facts);

  const breadcrumb = (
    <SimpleBreadcrumb
      items={[
        { label: "Inicio", href: routes.home },
        { label: "Maratones", href: routes.marathons },
        { label: edition.name, href: `/maratones/${edition.slug}` },
        { label: "Tu opinión" },
      ]}
    />
  );

  if (!eligibility.eligible) {
    return (
      <>
        {breadcrumb}
        <Section tone="base">
          <Container className="max-w-2xl">
            <SectionHeader
              eyebrow={edition.name}
              title="Esta encuesta es para quienes estuvieron"
            />
            <Card className="mt-[var(--ck-stack-subtitle-to-content)]">
              <p className="ck-body-md text-ck-text-secondary">
                {ELIGIBILITY_DENIAL_COPY[eligibility.reason]}
              </p>
            </Card>
          </Container>
        </Section>
      </>
    );
  }

  const existing = await testimonialRepository.findAnswer(edition.id, user.id);

  const defaults: TestimonialSurveyDefaults = {
    npsScore: existing?.response.npsScore ?? null,
    scores: existing?.response.scores ?? EMPTY_SCORES,
    wouldReturn: existing?.response.wouldReturn ?? null,
    improvementNotes: existing?.response.improvementNotes ?? "",
    publicQuote: existing?.testimonial?.quote ?? "",
    authorLinkUrl:
      existing?.testimonial?.authorLinkUrl ?? eligibility.suggestedLinkUrl ?? "",
    publicationConsent: existing?.testimonial?.publicationConsent ?? false,
  };

  return (
    <>
      {breadcrumb}
      <Section tone="base">
        <Container className="max-w-2xl">
          <SectionHeader
            eyebrow={edition.name}
            title="Contanos cómo te fue"
            description="Dos minutos. Nos sirve para mejorar la próxima y, si nos autorizás, para que otros lean lo que viviste."
          />
          <div className="mt-[var(--ck-stack-subtitle-to-content)]">
            <TestimonialSurveyForm
              editionSlug={edition.slug}
              editionName={edition.name}
              authorName={eligibility.authorName}
              authorRoleLabel={authorRoleLabel(eligibility.role)}
              hasPhoto={eligibility.authorPhotoAssetId !== null}
              defaults={defaults}
              alreadyAnswered={existing !== null}
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
