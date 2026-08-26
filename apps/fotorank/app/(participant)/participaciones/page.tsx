import Link from "next/link";
import { ParticipantEntryCard } from "../../components/participant";
import { requireAuth } from "../../lib/auth";
import { listMyParticipationViews } from "../../lib/fotorank/participant-experience";

export default async function ParticipacionesPage() {
  const user = await requireAuth();
  const views = await listMyParticipationViews(user.id);
  const count = views.length;

  return (
    <div className="fr-participant-page space-y-10">
      <header className="fr-participant-page__header space-y-4">
        <p className="fr-eyebrow text-gold">Participante</p>
        <div className="fr-participant-page__title-row">
          <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">
            Mis participaciones
          </h1>
          {count > 0 ? (
            <p className="fr-participant-page__count" aria-label={`${count} participaciones`}>
              {count} {count === 1 ? "participación" : "participaciones"}
            </p>
          ) : null}
        </div>
        <p className="max-w-2xl text-base leading-relaxed text-fr-muted">
          Consultá el estado de cada inscripción y qué tenés que hacer ahora.
        </p>
      </header>

      {count === 0 ? (
        <div className="fr-recuadro fr-participant-empty max-w-md border border-fr-border bg-fr-card">
          <p className="fr-body text-fr-muted">Todavía no tenés inscripciones.</p>
          <Link href="/" className="fr-btn fr-btn-primary fr-participant-empty__cta inline-flex w-fit px-6 py-3">
            Explorar concursos
          </Link>
        </div>
      ) : (
        <ul className="fr-participant-entry-grid" data-testid="participaciones-list">
          {views.map((view) => (
            <ParticipantEntryCard key={view.id} view={view} />
          ))}
        </ul>
      )}
    </div>
  );
}
