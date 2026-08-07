import Link from "next/link";
import { ArrowRight, Hash, Layers } from "lucide-react";
import type { ParticipantParticipationView } from "../../lib/fotorank/participant-experience";
import { formatParticipantDateShort } from "../../lib/fotorank/participant-experience";
import { ParticipantProgress } from "./ParticipantProgress";
import { ParticipantStatusPill } from "./ParticipantStatusPill";

type Props = {
  view: ParticipantParticipationView;
};

/**
 * Card resumida de participación (nivel 1).
 * La información operativa completa vive en /participaciones/[id].
 */
export function ParticipantEntryCard({ view }: Props) {
  const primary = view.nextAction;
  const openLabel =
    !view.upload.isOpen && view.upload.phase === "not_yet_open"
      ? formatParticipantDateShort(view.upload.opensAt)
      : null;

  return (
    <li className="fr-participant-entry-card" data-testid="participacion-card">
      <div className="fr-participant-entry-card__identity">
        <div className="fr-participant-entry-card__identity-top">
          <h2 className="fr-participant-entry-card__title">{view.contestTitle}</h2>
          <ParticipantStatusPill status={view.primaryStatus} />
        </div>
        <p className="fr-participant-entry-card__number-block">
          <span className="fr-participant-entry-card__label">
            <Hash width={12} height={12} aria-hidden className="inline-block" /> Número de participación
          </span>
          <span className="fr-participant-entry-card__number">{view.registrationNumber}</span>
        </p>
      </div>

      <dl className="fr-participant-entry-card__data">
        <div className="fr-participant-entry-card__field">
          <dt>
            <Layers width={12} height={12} aria-hidden className="inline-block" /> Categoría
          </dt>
          <dd>{view.categoryName}</dd>
        </div>
        <div className="fr-participant-entry-card__field fr-participant-entry-card__field--wide">
          <dt>Próximo paso</dt>
          <dd className="fr-participant-entry-card__photo">{view.nextStep.title}</dd>
        </div>
        {openLabel ? (
          <div className="fr-participant-entry-card__field fr-participant-entry-card__field--wide">
            <dt>Apertura de carga</dt>
            <dd>{openLabel}</dd>
          </div>
        ) : null}
      </dl>

      <ParticipantProgress steps={view.progress} compact />

      <div className="fr-participant-entry-card__actions">
        {primary.enabled ? (
          <Link
            href={primary.href}
            className={`fr-btn fr-btn-${primary.variant === "primary" ? "primary" : "secondary"} fr-participant-entry-card__cta`}
          >
            {primary.label}
            <ArrowRight width={16} height={16} aria-hidden />
          </Link>
        ) : (
          <span
            className="fr-btn fr-btn-secondary fr-participant-entry-card__cta"
            aria-disabled="true"
            title={primary.blockedReason}
          >
            {primary.label}
          </span>
        )}
        <Link
          href={`/concursos/${view.contestSlug}`}
          className="fr-btn fr-btn-secondary fr-participant-entry-card__cta"
        >
          Ver concurso
        </Link>
      </div>
    </li>
  );
}
