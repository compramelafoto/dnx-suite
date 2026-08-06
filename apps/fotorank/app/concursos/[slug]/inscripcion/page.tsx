import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { ContestShell, ContentToActions, Stack, Surface } from "../../../components/contest-public";
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
    return (
      <ContestShell cssVars={cssVars}>
        <main className="fr-contest-inscription">
          <div className="fr-contest-inscription__inner">
            <p className="fr-type-eyebrow">Inscripción</p>
            <p className="fr-type-caption mt-2">{contest.organization.name}</p>
            <h1 className="fr-type-h1 mt-3" style={{ color: "var(--cv-foreground)", maxWidth: "none" }}>
              {contest.title}
            </h1>
            <Surface className="mt-8" padding="lg">
              <Stack gap="md">
                <p className="fr-type-body-large" style={{ color: "var(--cv-foreground)" }}>
                  Ya estás inscripto/a.
                </p>
                <dl className="fr-contest-stack fr-contest-stack--sm">
                  <div>
                    <dt className="fr-type-caption">Número</dt>
                    <dd
                      className="mt-1 text-xl font-semibold text-gold"
                      data-testid="registration-number"
                    >
                      {existing.registrationNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="fr-type-caption">Categoría</dt>
                    <dd className="mt-1" style={{ color: "var(--cv-foreground)" }}>
                      {existing.categoryName}
                    </dd>
                  </div>
                  <div>
                    <dt className="fr-type-caption">Estado</dt>
                    <dd className="mt-1" style={{ color: "var(--cv-foreground)" }}>
                      {presentRegistrationStatus(existing.status).label}
                    </dd>
                  </div>
                </dl>
                <ContentToActions>
                  <Link
                    href={`/participaciones/${existing.id}`}
                    className="fr-btn fr-btn-primary w-fit"
                  >
                    Ver detalle de participación
                  </Link>
                  <Link href="/participaciones" className="fr-btn fr-btn-secondary w-fit">
                    Mis participaciones
                  </Link>
                </ContentToActions>
              </Stack>
            </Surface>
            {existing.status === "CONFIRMED" && requirements ? (
              <div className="mt-10">
                <ParticipantUploadWizard
                  contestId={contest.id}
                  contestSlug={slug}
                  registrationId={existing.id}
                  registrationNumber={existing.registrationNumber}
                  registrationStatus={existing.status}
                  requirements={requirements}
                  detailHref={`/participaciones/${existing.id}`}
                />
              </div>
            ) : null}
            <p className="mt-8">
              <Link href={`/concursos/${slug}`} className="fr-btn fr-btn-ghost">
                ← Volver al concurso
              </Link>
            </p>
          </div>
        </main>
      </ContestShell>
    );
  }

  const rules = await getCurrentPublishedRules(contest.id);
  const isFree = contest.registrationPricingMode === "FREE";

  return (
    <ContestShell cssVars={cssVars}>
      <main className="fr-contest-inscription">
        <div className="fr-contest-inscription__inner">
          <p className="fr-type-eyebrow">Inscripción</p>
          <p className="fr-type-caption mt-2">{contest.organization.name}</p>
          <h1 className="fr-type-h1 mt-3" style={{ color: "var(--cv-foreground)", maxWidth: "none" }}>
            {contest.title}
          </h1>
          <p className="fr-type-body mt-4">
            {isFree
              ? "Concurso gratuito: al confirmar quedarás inscripto/a sin cobro ni redirección a pagos."
              : "Concurso con inscripción paga: el cobro se completará vía DNX Payments (en preparación)."}
          </p>

          {!rules ? (
            <Surface className="fr-contest-surface--warning mt-8" padding="md">
              <p className="fr-type-body" style={{ color: "var(--cv-foreground)" }}>
                Todavía no hay bases publicadas. El organizador debe publicar una versión antes de abrir
                inscripciones.
              </p>
              <ContentToActions>
                <Link href={`/concursos/${slug}`} className="fr-btn fr-btn-secondary inline-flex w-fit">
                  Volver al concurso
                </Link>
              </ContentToActions>
            </Surface>
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
        </div>
      </main>
    </ContestShell>
  );
}
