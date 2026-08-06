import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../lib/auth";
import {
  getCurrentPublishedRules,
  getMyContestRegistration,
} from "../../../lib/fotorank/registration";
import {
  buildParticipantChecklist,
  presentArtworkStatus,
  presentRegistrationStatus,
} from "../../../lib/fotorank/public-ux/participant-status";
import {
  Notice,
  PageContainer,
  PageHeader,
  ParticipantDashboard,
  PrimaryButton,
  PublicShell,
  SecondaryButton,
} from "../../../components/public-ui";
import { InscriptionForm } from "./InscriptionForm";
import { EntryUploadPanel } from "./EntryUploadPanel";

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
      organization: { select: { name: true, contactEmail: true } },
    },
  });
  if (!contest) notFound();

  const loginNext = `/concursos/${slug}/inscripcion`;
  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  }

  const existing = await getMyContestRegistration(contest.id, user.id);
  const now = Date.now();
  const uploadOpens = contest.submissionOpensAt?.getTime() ?? null;
  const uploadCloses = contest.submissionDeadline?.getTime() ?? null;
  const uploadOpen =
    contest.status !== "CLOSED" &&
    contest.status !== "ARCHIVED" &&
    (uploadOpens == null || uploadOpens <= now) &&
    (uploadCloses == null || uploadCloses >= now);

  if (existing && existing.status !== "CANCELLED" && existing.status !== "DISQUALIFIED") {
    const entry = await prisma.fotorankContestEntry.findFirst({
      where: { registrationId: existing.id },
      select: {
        status: true,
        entryNumber: true,
        technicalSummaryStatus: true,
        publicRejectionReason: true,
        title: true,
      },
    });

    const registrationStatus = presentRegistrationStatus(existing.status);
    const artworkStatus = presentArtworkStatus({
      hasEntry: Boolean(entry),
      entryStatus: entry?.status,
      technicalSummaryStatus: entry?.technicalSummaryStatus,
      uploadOpen,
    });
    const checklist = buildParticipantChecklist({
      registered: true,
      registrationStatus: existing.status,
      hasEntry: Boolean(entry),
      entryStatus: entry?.status,
      uploadOpen,
    });

    const primaryAction =
      uploadOpen && existing.status === "CONFIRMED" && !entry ? (
        <PrimaryButton href="#cargar-fotografia">Cargar fotografía</PrimaryButton>
      ) : (
        <PrimaryButton href="/participaciones">Ver mis participaciones</PrimaryButton>
      );

    return (
      <PublicShell
        organizationName={contest.organization.name}
        supportEmail={contest.organization.contactEmail}
        header={{
          variant: "participant",
          hasSession: true,
          userEmail: user.email,
          panelHref: "/participaciones",
        }}
      >
        <PageContainer width="readable" className="py-12 md:py-16">
          <ParticipantDashboard
            contestTitle={contest.title}
            participantLabel={user.email}
            registrationStatus={registrationStatus}
            artworkStatus={artworkStatus}
            categoryName={existing.categoryName}
            registrationNumber={existing.registrationNumber}
            relevantDateLabel={
              contest.submissionDeadline
                ? `Cierre: ${contest.submissionDeadline.toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}`
                : null
            }
            checklist={checklist}
            primaryAction={primaryAction}
            notice={
              existing.status === "CONFIRMED" && !uploadOpen ? (
                <Notice tone="warning" data-testid="upload-closed-notice">
                  La carga de fotografías todavía no está habilitada. Tu inscripción quedó
                  confirmada; te avisaremos cuando puedas subir tu obra.
                </Notice>
              ) : null
            }
            artworks={
              entry ? (
                <div className="fr-public-card space-y-3" data-testid="participation-entry-summary">
                  <p className="font-semibold text-[var(--foreground)]">
                    {entry.title?.trim() || "Tu fotografía"}
                  </p>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {artworkStatus.label}
                    {entry.entryNumber ? ` · ${entry.entryNumber}` : ""}
                  </p>
                  {entry.publicRejectionReason ? (
                    <Notice tone="warning" title="Observación">
                      {entry.publicRejectionReason}
                    </Notice>
                  ) : null}
                </div>
              ) : (
                <Notice tone="info">Todavía no hay una fotografía presentada.</Notice>
              )
            }
          />

          {existing.status === "CONFIRMED" && uploadOpen ? (
            <div id="cargar-fotografia" className="mt-12">
              <EntryUploadPanel contestId={contest.id} contestSlug={slug} />
            </div>
          ) : null}

          <div className="fr-public-actions">
            <SecondaryButton href={`/concursos/${slug}`}>Volver al concurso</SecondaryButton>
          </div>
        </PageContainer>
      </PublicShell>
    );
  }

  const rules = await getCurrentPublishedRules(contest.id);
  const isFree = contest.registrationPricingMode === "FREE";

  return (
    <PublicShell
      organizationName={contest.organization.name}
      supportEmail={contest.organization.contactEmail}
      header={{
        variant: "participant",
        hasSession: true,
        userEmail: user.email,
        panelHref: "/participaciones",
      }}
    >
      <PageContainer width="readable" className="py-12 md:py-16">
        <PageHeader
          eyebrow={`Inscripción · ${contest.organization.name}`}
          title={contest.title}
          description={
            isFree
              ? "Concurso gratuito: al confirmar quedarás inscripto/a sin cobro ni redirección a pagos."
              : "Concurso con inscripción paga: el cobro se completará vía el proceso de pago indicado."
          }
        />

        {!rules ? (
          <Notice tone="warning" className="mt-10" title="Bases pendientes">
            <p>
              Todavía no hay bases publicadas. El organizador debe publicar una versión antes de
              abrir inscripciones.
            </p>
            <div className="mt-6">
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
    </PublicShell>
  );
}
