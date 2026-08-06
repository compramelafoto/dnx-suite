import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { ContestShell } from "../../../components/contest-public";
import {
  Notice,
  PageContainer,
  PageHeader,
  PrimaryButton,
  PublicShell,
  SecondaryButton,
  StatusBadge,
} from "../../../components/public-ui";
import {
  contestThemeToCssVars,
  resolveContestVisualTheme,
} from "../../../lib/fotorank/contest-visual";
import { getAuthUser } from "../../../lib/auth";
import {
  getCurrentPublishedRules,
  getMyContestRegistration,
} from "../../../lib/fotorank/registration";
import {
  presentRegistrationStatus,
  resolveUploadWindow,
} from "../../../lib/fotorank/participant-experience";
import { buildUploadRequirementsSummary } from "../../../lib/fotorank/participant-upload";
import { ParticipantUploadWizard } from "../../../components/participant-upload";
import { InscriptionForm } from "./InscriptionForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const contest = await prisma.fotorankContest.findFirst({
    where: { slug, visibility: { in: ["PUBLIC", "UNLISTED"] } },
    select: { title: true },
  });
  return { title: contest ? `Inscripción · ${contest.title}` : "Inscripción | FotoRank" };
}

export default async function ContestInscriptionPage({ params }: Props) {
  const { slug } = await params;
  const contest = await prisma.fotorankContest.findFirst({
    where: {
      slug,
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      status: { in: ["PUBLISHED", "ACTIVE"] },
    },
    include: {
      categories: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      organization: { select: { name: true, logoUrl: true } },
    },
  });
  if (!contest) notFound();

  const theme = resolveContestVisualTheme(slug, {
    organizerLogoUrl: contest.organization.logoUrl ?? "",
  });
  const cssVars = contestThemeToCssVars(theme);

  const loginNext = `/concursos/${slug}/inscripcion`;
  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  }

  const shellHeader = {
    variant: "contest" as const,
    hasSession: true,
    userEmail: user.email,
    panelHref: "/participaciones",
  };

  const existing = await getMyContestRegistration(contest.id, user.id);
  const uploadWindow = resolveUploadWindow({
    submissionOpensAt: contest.submissionOpensAt,
    submissionDeadline: contest.submissionDeadline,
    registrationOpensAt: contest.registrationOpensAt,
    registrationClosesAt: contest.registrationClosesAt,
    startAt: contest.startAt,
    status: contest.status,
  });
  if (existing && existing.status !== "CANCELLED" && existing.status !== "DISQUALIFIED") {
    const category =
      contest.categories.find((c) => c.id === existing.categoryId) ?? contest.categories[0];
    const requirements = category
      ? buildUploadRequirementsSummary({
          contestSlug: slug,
          categoryName: existing.categoryName,
          categorySlug: category.slug,
          maxFiles: category.maxFiles,
          uploadPolicyJson: contest.uploadPolicyJson,
          uploadWindow,
          basesHref: `/concursos/${slug}#bases`,
          timezone: contest.timezone,
        })
      : null;
    const regStatus = presentRegistrationStatus(existing.status);
    const badgeTone =
      regStatus.tone === "info"
        ? ("primary" as const)
        : regStatus.tone === "locked"
          ? ("neutral" as const)
          : regStatus.tone;
    return (
      <PublicShell header={shellHeader} showFooter>
        <ContestShell cssVars={cssVars}>
          <main className="fr-contest-inscription">
            <PageContainer width="readable" className="fr-contest-inscription__inner space-y-10">
              <PageHeader
                eyebrow="Inscripción"
                title={contest.title}
                description={`${contest.organization.name}. Ya estás inscripto/a en este concurso.`}
                actions={
                  <div className="flex flex-col items-stretch gap-3 sm:items-end">
                    <StatusBadge
                      label={regStatus.label}
                      tone={badgeTone}
                      stateText="Estado de inscripción"
                    />
                    <SecondaryButton href={`/concursos/${slug}`} size="md">
                      Volver al concurso
                    </SecondaryButton>
                  </div>
                }
              />

              <section className="fr-public-card" aria-labelledby="inscription-summary-title">
                <h2 id="inscription-summary-title" className="fr-public-title text-xl">
                  Resumen de inscripción
                </h2>
                <dl className="fr-public-meta-list">
                  <div className="fr-public-meta-list__item">
                    <dt>Número</dt>
                    <dd
                      className="fr-public-meta-list__value--accent text-xl"
                      data-testid="registration-number"
                    >
                      {existing.registrationNumber}
                    </dd>
                  </div>
                  <div className="fr-public-meta-list__item">
                    <dt>Categoría</dt>
                    <dd>{existing.categoryName}</dd>
                  </div>
                  <div className="fr-public-meta-list__item">
                    <dt>Estado</dt>
                    <dd>{regStatus.label}</dd>
                  </div>
                </dl>
                <div className="fr-public-card-actions">
                  <PrimaryButton href={`/participaciones/${existing.id}`}>
                    Ver detalle de participación
                  </PrimaryButton>
                  <SecondaryButton href="/participaciones">Mis participaciones</SecondaryButton>
                </div>
              </section>

              {existing.status === "CONFIRMED" && requirements ? (
                <ParticipantUploadWizard
                  contestId={contest.id}
                  contestSlug={slug}
                  registrationId={existing.id}
                  registrationNumber={existing.registrationNumber}
                  registrationStatus={existing.status}
                  requirements={requirements}
                  detailHref={`/participaciones/${existing.id}`}
                />
              ) : null}
            </PageContainer>
          </main>
        </ContestShell>
      </PublicShell>
    );
  }

  const rules = await getCurrentPublishedRules(contest.id);
  const isFree = contest.registrationPricingMode === "FREE";

  return (
    <PublicShell header={shellHeader} showFooter>
      <ContestShell cssVars={cssVars}>
        <main className="fr-contest-inscription">
          <PageContainer width="readable" className="fr-contest-inscription__inner space-y-10">
            <PageHeader
              eyebrow="Inscripción"
              title={contest.title}
              description={
                isFree
                  ? `${contest.organization.name}. Concurso gratuito: al confirmar quedarás inscripto/a sin cobro ni redirección a pagos.`
                  : `${contest.organization.name}. Concurso con inscripción paga: el cobro se completará vía DNX Payments (en preparación).`
              }
              actions={
                <SecondaryButton href={`/concursos/${slug}`}>Volver al concurso</SecondaryButton>
              }
            />

            {!rules ? (
              <Notice tone="warning" title="Bases no publicadas">
                <p>
                  Todavía no hay bases publicadas. El organizador debe publicar una versión antes de
                  abrir inscripciones.
                </p>
                <div className="fr-public-card-actions border-0 pt-6">
                  <SecondaryButton href={`/concursos/${slug}`}>Volver al concurso</SecondaryButton>
                </div>
              </Notice>
            ) : (
              <InscriptionForm
                contestId={contest.id}
                contestSlug={slug}
                categories={contest.categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  maxFiles: c.maxFiles,
                }))}
                rules={{
                  id: rules.id,
                  versionNumber: rules.versionNumber,
                  title: rules.title,
                  content: rules.content,
                }}
                isFree={isFree}
              />
            )}
          </PageContainer>
        </main>
      </ContestShell>
    </PublicShell>
  );
}
