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
import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import {
  ELIGIBILITY_DENIAL_COPY,
  resolveEligibility,
} from "@/lib/testimonials/domain/eligibility";
import { resolveSurveyAccess } from "@/lib/testimonials/domain/survey-access";
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

  if (!edition) notFound();

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
  const access = resolveSurveyAccess({
    moduleEnabled: edition.testimonialsEnabled,
    eligibility,
    isAdmin: hasClickatonAdminAccess(user),
  });

  // Con la encuesta apagada y sin ser admin, la página no existe.
  if (access.mode === "closed") notFound();

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

  if (access.mode === "denied") {
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
                {ELIGIBILITY_DENIAL_COPY[access.reason]}
              </p>
            </Card>
          </Container>
        </Section>
      </>
    );
  }

  const isPreview = access.mode === "preview";
  const author = access.mode === "answer" ? access.author : null;

  // En vista previa no se consulta ninguna respuesta: no hay autor del que
  // traer nada, y el formulario arranca en blanco como lo vería un recién
  // llegado.
  const existing = author
    ? await testimonialRepository.findAnswer(edition.id, user.id)
    : null;

  const defaults: TestimonialSurveyDefaults = {
    npsScore: existing?.response.npsScore ?? null,
    scores: existing?.response.scores ?? EMPTY_SCORES,
    wouldReturn: existing?.response.wouldReturn ?? null,
    improvementNotes: existing?.response.improvementNotes ?? "",
    publicQuote: existing?.testimonial?.quote ?? "",
    authorLinkUrl:
      existing?.testimonial?.authorLinkUrl ?? author?.suggestedLinkUrl ?? "",
    publicationConsent: existing?.testimonial?.publicationConsent ?? false,
  };

  return (
    <>
      {breadcrumb}
      <Section tone="base">
        <Container className="max-w-2xl">
          <SectionHeader
            eyebrow={edition.name}
            title={isPreview ? "Así se ve la encuesta" : "Contanos cómo te fue"}
            description={
              isPreview
                ? "Estás mirando el formulario como administrador."
                : "Dos minutos. Nos sirve para mejorar la próxima y, si nos autorizás, para que otros lean lo que viviste."
            }
          />
          <div className="mt-[var(--ck-stack-subtitle-to-content)]">
            <TestimonialSurveyForm
              editionSlug={edition.slug}
              editionName={edition.name}
              authorName={author?.authorName ?? user.name?.trim() ?? user.email}
              authorRoleLabel={
                author ? authorRoleLabel(author.role) : "Participante (ejemplo)"
              }
              hasPhoto={author?.authorPhotoAssetId != null}
              defaults={defaults}
              alreadyAnswered={existing !== null}
              preview={
                isPreview && access.mode === "preview"
                  ? { moduleEnabled: access.moduleEnabled }
                  : null
              }
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
