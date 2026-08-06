import { notFound } from "next/navigation";
import {
  Notice,
  ParticipantDashboard,
  PrimaryButton,
  SecondaryButton,
} from "../../../components/public-ui";
import { requireAuth } from "../../../lib/auth";
import {
  formatParticipantDate,
  getMyParticipationView,
} from "../../../lib/fotorank/participant-experience";
import { resolvePublicEntryStatus } from "../../../lib/fotorank/participant-experience/public-entry-status";
import {
  buildParticipantChecklist,
  presentArtworkStatus,
  presentRegistrationStatus,
  type StatusTone,
} from "../../../lib/fotorank/public-ux/participant-status";

type Props = { params: Promise<{ id: string }> };

function toBadgeTone(tone: string): StatusTone {
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "primary") {
    return tone;
  }
  return "neutral";
}

export default async function ParticipacionDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const view = await getMyParticipationView(user.id, id);
  if (!view) notFound();

  const registrationStatus = presentRegistrationStatus(view.registrationStatus);
  const artworkBase = presentArtworkStatus({
    hasEntry: Boolean(view.entry),
    entryStatus: view.entry?.status,
    technicalSummaryStatus: view.entry?.technicalSummaryStatus,
    uploadOpen: view.upload.isOpen,
  });
  const publicPhoto = resolvePublicEntryStatus({
    entryStatus: view.entry?.status,
    admissionStatus: view.entry?.admissionStatus,
    manualReviewStatus: view.entry?.manualReviewStatus,
  });
  const artworkStatus = view.entry
    ? {
        ...artworkBase,
        label: publicPhoto.label,
      }
    : artworkBase;

  const checklist = buildParticipantChecklist({
    registered: true,
    registrationStatus: view.registrationStatus,
    hasEntry: Boolean(view.entry),
    entryStatus: view.entry?.status,
    uploadOpen: view.upload.isOpen,
  });

  const uploadOpenLabel = formatParticipantDate(view.upload.opensAt, {
    includeTime: true,
    timeZone: view.timezone,
  });
  const relevantDateLabel =
    formatParticipantDate(view.dates.submissionDeadline ?? view.upload.closesAt, {
      includeTime: true,
      timeZone: view.timezone,
    }) ??
    formatParticipantDate(view.dates.registrationClosesAt, {
      timeZone: view.timezone,
    });

  const showUploadClosed =
    view.registrationStatus === "CONFIRMED" && !view.upload.isOpen && !view.entry;

  const primary = view.nextAction;
  const primaryHref =
    primary.key === "view_detail" ? `/concursos/${view.contestSlug}/inscripcion` : primary.href;

  return (
    <div className="space-y-10" data-testid="participacion-detail">
      <ParticipantDashboard
        contestTitle={view.contestTitle}
        participantLabel={user.email}
        registrationStatus={{
          ...registrationStatus,
          tone: toBadgeTone(registrationStatus.tone),
        }}
        artworkStatus={{
          ...artworkStatus,
          tone: toBadgeTone(artworkStatus.tone),
        }}
        categoryName={view.categoryName}
        registrationNumber={view.registrationNumber}
        relevantDateLabel={
          relevantDateLabel ? `Fecha relevante: ${relevantDateLabel}` : null
        }
        checklist={checklist}
        primaryAction={
          <div className="flex w-full flex-col gap-3 sm:items-end">
            {primary.enabled ? (
              <PrimaryButton href={primaryHref}>{primary.label}</PrimaryButton>
            ) : null}
            <SecondaryButton href={`/concursos/${view.contestSlug}`}>Ver concurso</SecondaryButton>
            <SecondaryButton href="/participaciones">Mis participaciones</SecondaryButton>
          </div>
        }
        notice={
          showUploadClosed ? (
            <Notice tone="info" title="Carga de fotografías aún no habilitada">
              <p>
                Tu inscripción está confirmada. La carga de fotografías todavía no está habilitada.
                Podés revisar tus datos; cuando abra la ventana de carga vas a poder continuar desde
                la inscripción.
              </p>
              {uploadOpenLabel ? (
                <p className="mt-3">Apertura prevista: {uploadOpenLabel}</p>
              ) : null}
              {view.timezone ? (
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                  Zona horaria del concurso: {view.timezone}
                </p>
              ) : null}
            </Notice>
          ) : view.nextStep?.message ? (
            <Notice
              tone={
                view.nextStep.tone === "warning" || view.nextStep.tone === "danger"
                  ? view.nextStep.tone
                  : "info"
              }
              title={view.nextStep.title}
            >
              <p>{view.nextStep.message}</p>
            </Notice>
          ) : null
        }
        artworks={
          view.entry ? (
            <div className="fr-public-card">
              <dl className="fr-public-meta-list">
                <div className="fr-public-meta-list__item">
                  <dt>Estado</dt>
                  <dd>{publicPhoto.label}</dd>
                </div>
                {view.entry.entryNumber ? (
                  <div className="fr-public-meta-list__item">
                    <dt>Número de obra</dt>
                    <dd className="fr-public-meta-list__value--accent">{view.entry.entryNumber}</dd>
                  </div>
                ) : null}
                {view.entry.publicRejectionReason ? (
                  <div className="fr-public-meta-list__item">
                    <dt>Observación</dt>
                    <dd>{view.entry.publicRejectionReason}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <div className="fr-public-card text-[var(--foreground-muted)]">
              {view.upload.isOpen
                ? "Todavía no cargaste fotografías. Podés comenzar desde Continuar participación."
                : `Sin fotografías todavía${
                    uploadOpenLabel ? ` · apertura ${uploadOpenLabel}` : ""
                  }.`}
            </div>
          )
        }
      />

      <section className="fr-public-card" aria-labelledby="detail-links-title">
        <h2 id="detail-links-title" className="fr-public-title text-xl">
          Enlaces
        </h2>
        <div className="fr-public-card-actions">
          <SecondaryButton href={`/concursos/${view.contestSlug}#bases`}>
            Consultar bases
          </SecondaryButton>
          <SecondaryButton href={`/concursos/${view.contestSlug}/inscripcion`}>
            Ir a la inscripción
          </SecondaryButton>
        </div>
      </section>
    </div>
  );
}
