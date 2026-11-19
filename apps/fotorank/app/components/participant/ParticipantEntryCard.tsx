import Link from "next/link";
import { ArrowRight, Camera } from "lucide-react";
import type { ParticipantParticipationView } from "../../lib/fotorank/participant-experience";
import { participantStepHints } from "./participant-step-hints";
import { ParticipantPhotoStrip } from "./ParticipantPhotoStrip";
import { ParticipantProgress } from "./ParticipantProgress";
import { ParticipantStatusPill } from "./ParticipantStatusPill";

type Props = {
  view: ParticipantParticipationView;
};

/** Acciones que sólo llevan a mirar: no hay nada pendiente para el participante. */
const PASSIVE_ACTIONS = new Set(["view_detail", "view_contest", "view_bases"]);

/**
 * Tarjeta de una participación.
 *
 * Orden pensado para leer de arriba hacia abajo: qué concurso es (portada y
 * nombre), en qué etapa está, qué tiene que hacer ahora, y sus fotos. Un solo
 * botón principal; lo demás queda como enlace.
 */
export function ParticipantEntryCard({ view }: Props) {
  const primary = view.nextAction;
  const detailHref = `/participaciones/${view.id}`;
  const passive = PASSIVE_ACTIONS.has(primary.key);
  const primaryLabel = primary.key === "view_detail" ? "Ver mi participación" : primary.label;
  const addHref =
    view.upload.isOpen && view.registrationStatus === "CONFIRMED" && !view.needsRulesReacceptance
      ? `/concursos/${view.contestSlug}/inscripcion`
      : null;

  return (
    <li className="fr-pp-card" data-testid="participacion-card">
      <Link href={detailHref} className="fr-pp-card__cover" tabIndex={-1} aria-hidden>
        {view.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- portada del concurso, ya optimizada al subirla
          <img src={view.cover.url} alt="" loading="lazy" className="fr-pp-card__cover-img" />
        ) : (
          <span className="fr-pp-card__cover-empty">
            <Camera width={28} height={28} strokeWidth={1.5} />
          </span>
        )}
      </Link>

      <div className="fr-pp-card__body">
        <header className="fr-pp-card__head">
          <div className="fr-pp-card__titles">
            {view.organizerName ? <p className="fr-pp-card__org">{view.organizerName}</p> : null}
            <h2 className="fr-pp-card__title">
              <Link href={detailHref}>{view.contestTitle}</Link>
            </h2>
            <p className="fr-pp-card__meta">
              <span>{view.categoryName}</span>
              <span aria-hidden>·</span>
              <span className="fr-pp-card__number">N.º {view.registrationNumber}</span>
            </p>
          </div>
          <ParticipantStatusPill status={view.primaryStatus} />
        </header>

        <ParticipantProgress steps={view.progress} hints={participantStepHints(view)} compact />

        <div className={`fr-pp-now fr-pp-now--${passive ? "calm" : "action"}`}>
          <p className="fr-pp-now__eyebrow">{passive ? "Estado" : "Lo que tenés que hacer"}</p>
          <p className="fr-pp-now__title">{view.nextStep.title}</p>
          <p className="fr-pp-now__message">{view.nextStep.message}</p>
        </div>

        {view.registrationStatus === "CONFIRMED" ? (
          <ParticipantPhotoStrip photos={view.photos} maxFiles={view.maxFiles} addHref={addHref} />
        ) : null}

        <div className="fr-pp-card__actions">
          {primary.enabled ? (
            <Link
              href={primary.href}
              className={`fr-btn ${passive ? "fr-btn-secondary" : "fr-btn-primary"} fr-pp-card__cta`}
            >
              {primaryLabel}
              <ArrowRight width={16} height={16} aria-hidden />
            </Link>
          ) : (
            <span className="fr-btn fr-btn-secondary fr-pp-card__cta" aria-disabled="true" title={primary.blockedReason}>
              {primaryLabel}
            </span>
          )}
          {primary.href !== detailHref ? (
            <Link href={detailHref} className="fr-pp-card__link">
              Ver detalle
            </Link>
          ) : (
            <Link href={`/concursos/${view.contestSlug}`} className="fr-pp-card__link">
              Ver concurso
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
