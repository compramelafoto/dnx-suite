import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hash, Layers } from "lucide-react";
import {
  ParticipantNextStep,
  ParticipantProgress,
  ParticipantStatusPill,
  ParticipantUploadClosedNotice,
  RulesReacceptanceCard,
} from "../../../components/participant";
import { ContestInfoBadge } from "../../../components/contest-public";
import { requireAuth } from "../../../lib/auth";
import {
  formatParticipantDate,
  formatParticipantDateShort,
  getMyParticipationView,
  presentEntryStatus,
  presentPaymentStatus,
  presentRegistrationStatus,
} from "../../../lib/fotorank/participant-experience";
import { getCurrentPublishedRules } from "../../../lib/fotorank/registration";

type Props = { params: Promise<{ id: string }> };

export default async function ParticipacionDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const view = await getMyParticipationView(user.id, id);
  if (!view) notFound();

  const regStatus = presentRegistrationStatus(view.registrationStatus);
  const payStatus = presentPaymentStatus(view.paymentStatus);
  const entryStatus = presentEntryStatus(view.entry?.status);
  const primary = view.nextAction;
  const showUploadClosed =
    view.registrationStatus === "CONFIRMED" &&
    !view.upload.isOpen &&
    !view.entry &&
    !view.needsRulesReacceptance;
  const currentRules =
    view.needsRulesReacceptance
      ? await getCurrentPublishedRules(view.contestId)
      : null;

  return (
    <div className="fr-participant-detail space-y-10" data-testid="participacion-detail">
      <nav className="fr-participant-detail__nav" aria-label="Migas">
        <Link href="/participaciones" className="fr-participant-detail__back">
          <ArrowLeft width={16} height={16} aria-hidden />
          Mis participaciones
        </Link>
      </nav>

      <header className="fr-participant-detail__header">
        <div className="fr-participant-detail__header-main">
          <p className="fr-eyebrow text-gold">Participación</p>
          <h1 className="fr-participant-detail__title">{view.contestTitle}</h1>
          <div className="fr-participant-detail__meta">
            <ParticipantStatusPill status={view.primaryStatus} />
            <span className="fr-participant-detail__meta-item">
              <Layers width={14} height={14} aria-hidden />
              {view.categoryName}
            </span>
            <span className="fr-participant-detail__meta-item">
              <Hash width={14} height={14} aria-hidden />
              {view.registrationNumber}
            </span>
          </div>
        </div>
        <div className="fr-participant-detail__header-actions">
          {primary.enabled && primary.key !== "reaccept_rules" ? (
            <Link
              href={primary.href}
              className={`fr-btn fr-btn-${primary.variant === "primary" ? "primary" : "secondary"} w-full md:w-auto`}
            >
              {primary.label}
            </Link>
          ) : null}
          {primary.key !== "view_contest" ? (
            <Link
              href={`/concursos/${view.contestSlug}`}
              className="fr-btn fr-btn-secondary w-full md:w-auto"
            >
              Ver concurso
            </Link>
          ) : null}
        </div>
      </header>

      <ParticipantNextStep block={view.nextStep} />

      {view.needsRulesReacceptance && currentRules ? (
        <RulesReacceptanceCard
          contestId={view.contestId}
          currentRulesVersionId={currentRules.id}
          currentRulesContent={currentRules.content}
          currentRulesTitle={currentRules.title}
        />
      ) : null}

      <section className="fr-participant-detail__section" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="fr-participant-detail__section-title">
          Progreso
        </h2>
        <ParticipantProgress steps={view.progress} />
      </section>

      {showUploadClosed ? (
        <ParticipantUploadClosedNotice
          upload={view.upload}
          maxFiles={view.maxFiles}
          timezone={view.timezone}
        />
      ) : null}

      <section className="fr-participant-detail__section" aria-labelledby="status-heading">
        <h2 id="status-heading" className="fr-participant-detail__section-title">
          Estado
        </h2>
        <dl className="fr-participant-detail__dl">
          <div>
            <dt>Inscripción</dt>
            <dd>{regStatus.label}</dd>
          </div>
          {view.paymentStatus !== "NOT_REQUIRED" ? (
            <div>
              <dt>Pago</dt>
              <dd>{payStatus.label}</dd>
            </div>
          ) : null}
          <div>
            <dt>Fotografía</dt>
            <dd>{entryStatus.label}</dd>
          </div>
          <div>
            <dt>Obras</dt>
            <dd>
              {view.uploadedCount} de {view.maxFiles}
            </dd>
          </div>
        </dl>
      </section>

      <section className="fr-participant-detail__section" aria-labelledby="category-heading">
        <h2 id="category-heading" className="fr-participant-detail__section-title">
          Categoría
        </h2>
        <p className="fr-participant-detail__category-name">{view.categoryName}</p>
        <ul className="fr-participant-detail__badges">
          {view.categoryPresentation.badges.map((b) => (
            <li key={b.key}>
              <ContestInfoBadge label={b.label} tone={b.tone} icon={b.icon} />
            </li>
          ))}
        </ul>
        {view.categoryPresentation.requirementNote ? (
          <p className="fr-participant-detail__note">{view.categoryPresentation.requirementNote}</p>
        ) : null}
      </section>

      <section className="fr-participant-detail__section" aria-labelledby="dates-heading">
        <h2 id="dates-heading" className="fr-participant-detail__section-title">
          Fechas importantes
        </h2>
        <dl className="fr-participant-detail__dl">
          {(
            [
              ["Cierre de inscripción", view.dates.registrationClosesAt],
              ["Apertura de carga", view.dates.submissionOpensAt ?? view.upload.opensAt],
              ["Cierre de carga", view.dates.submissionDeadline ?? view.upload.closesAt],
              ["Inicio de evaluación", view.dates.judgingStartAt],
              ["Resultados", view.dates.resultsAt],
            ] as const
          )
            .map(([label, value]) => {
              const formatted = formatParticipantDate(value, {
                includeTime: label.includes("carga"),
                timeZone: view.timezone,
              });
              return formatted ? { label, formatted } : null;
            })
            .filter(Boolean)
            .map((row) => (
              <div key={row!.label}>
                <dt>{row!.label}</dt>
                <dd>{row!.formatted}</dd>
              </div>
            ))}
        </dl>
        {view.timezone ? (
          <p className="fr-participant-detail__tz">Zona horaria del concurso: {view.timezone}</p>
        ) : null}
      </section>

      <section className="fr-participant-detail__section" aria-labelledby="works-heading">
        <h2 id="works-heading" className="fr-participant-detail__section-title">
          Obras
        </h2>
        {!view.entry ? (
          <div className="fr-participant-works-empty">
            {view.upload.isOpen ? (
              <p className="fr-body text-fr-muted">
                Todavía no cargaste fotografías. Podés comenzar cuando quieras.
              </p>
            ) : (
              <p className="fr-body text-fr-muted">
                Sin fotografías todavía
                {view.upload.phase === "not_yet_open" && view.upload.opensAt
                  ? ` · apertura ${formatParticipantDateShort(view.upload.opensAt)}`
                  : ""}
                .
              </p>
            )}
          </div>
        ) : (
          <dl className="fr-participant-detail__dl">
            <div>
              <dt>Estado</dt>
              <dd>{entryStatus.label}</dd>
            </div>
            {view.entry.entryNumber ? (
              <div>
                <dt>Número de obra</dt>
                <dd>{view.entry.entryNumber}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      <section className="fr-participant-detail__section fr-participant-detail__links">
        <h2 className="fr-participant-detail__section-title">Enlaces</h2>
        <div className="fr-participant-detail__link-row">
          <Link href={`/concursos/${view.contestSlug}#bases`} className="fr-btn fr-btn-secondary">
            Consultar bases
          </Link>
          <Link href={`/concursos/${view.contestSlug}`} className="fr-btn fr-btn-ghost">
            Página pública del concurso
          </Link>
        </div>
      </section>
    </div>
  );
}
