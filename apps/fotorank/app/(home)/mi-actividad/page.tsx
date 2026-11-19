import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "../../lib/auth";
import { ParticipantEntryCard, ParticipantHowItWorks } from "../../components/participant";
import { resolveHomeCapabilities } from "../../lib/fotorank/access/home-capabilities";
import {
  listMyParticipationViews,
  type ParticipantParticipationView,
} from "../../lib/fotorank/participant-experience";

export default async function MiActividadPage() {
  const user = await requireAuth();
  const caps = await resolveHomeCapabilities({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  // El hub es del fotógrafo. El super admin tiene su propio inicio.
  if (caps.isSuperAdmin) redirect("/super-admin");

  /*
   * Misma vista que "Mis participaciones": estado en palabras, etapas, próximo
   * paso y fotos. Antes mostraba el estado crudo ("CONFIRMED") y un "Continuar"
   * que siempre llevaba al formulario de inscripción.
   */
  const views: ParticipantParticipationView[] = caps.hasParticipations
    ? await listMyParticipationViews(user.id).catch(() => [])
    : [];
  const shown = views.slice(0, 3);

  /*
   * Fuera de eso, esta página no redirige. Antes, con un solo perfil, mandaba a la persona a
   * otro panel: apretar "Inicio" en el menú la sacaba de Inicio. A dónde entra
   * cada uno después del login lo decide `resolvePostLoginPath`, una sola vez.
   */

  return (
    <div className="space-y-10" data-testid="mi-actividad-hub">
      <header className="space-y-4">
        <p className="fr-eyebrow text-gold">Fotógrafo</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">
          Hola{user.name?.trim() ? `, ${user.name.trim().split(/\s+/)[0]}` : ""}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-fr-muted">
          En qué etapa está cada concurso y qué tenés que hacer.
        </p>
      </header>

      {caps.degraded ? (
        <section
          className="fr-recuadro max-w-xl border border-amber-500/40 bg-fr-card"
          data-testid="mi-actividad-degraded"
        >
          <h2 className="text-lg font-semibold tracking-tight">
            No pudimos confirmar toda tu actividad
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fr-muted">
            Algunas secciones pueden faltar por un problema temporal. Lo que sí ves abajo
            es información confirmada. Podés recargar la página en unos segundos.
          </p>
          {caps.incidentId ? (
            <p className="mt-2 font-mono text-xs text-fr-muted">
              Código de incidente: {caps.incidentId}
            </p>
          ) : null}
        </section>
      ) : null}

      {!caps.hasParticipations && !caps.degraded ? (
        <section className="fr-recuadro max-w-xl border border-fr-border bg-fr-card" data-testid="mi-actividad-empty">
          <h2 className="text-xl font-semibold tracking-tight">Todavía no participaste de ningún concurso</h2>
          <p className="mt-4 text-sm leading-relaxed text-fr-muted">
            Buscá un concurso abierto e inscribite desde su página.
          </p>
          <Link href="/" className="fr-btn fr-btn-primary mt-8 inline-flex w-fit px-6 py-3">
            Explorar concursos
          </Link>
        </section>
      ) : null}

      {caps.hasParticipations ? (
        <section className="fr-pp-section" data-testid="section-participaciones">
          <div className="fr-pp-section__head">
            <h2 className="fr-pp-section__title">Tus concursos</h2>
            {views.length > shown.length ? (
              <Link href="/participaciones" className="fr-pp-section__more">
                Ver las {views.length} →
              </Link>
            ) : null}
          </div>
          {shown.length > 0 ? (
            <ul className="fr-pp-list">
              {shown.map((view) => (
                <ParticipantEntryCard key={view.id} view={view} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fr-muted">
              No pudimos cargar tus participaciones.{" "}
              <Link href="/participaciones" className="text-gold hover:text-gold-hover">
                Abrir Mis participaciones
              </Link>
            </p>
          )}
          <ParticipantHowItWorks />
        </section>
      ) : null}

      {/*
       * Organizaciones y tareas de jurado ya no se muestran acá: cada una tiene
       * su rol en el selector de arriba de la barra. Esta página es la del
       * fotógrafo; antes mezclaba las tres cosas y se llamaba "Hub personal".
       */}
      {caps.hasOrganizations || caps.hasJuryAccount ? (
        <section className="space-y-4" data-testid="otros-roles">
          <h2 className="text-lg font-semibold tracking-tight">Tus otros roles</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {caps.hasJuryAccount ? (
              <Link
                href="/jurado/panel"
                className="fr-recuadro border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
              >
                <span className="font-semibold text-fr-primary">Jurado</span>
                <span className="mt-1 block text-sm text-fr-muted">
                  {caps.juryContests.length === 1
                    ? "1 concurso para calificar"
                    : `${caps.juryContests.length} concursos para calificar`}
                </span>
              </Link>
            ) : null}
            {caps.hasOrganizations ? (
              <Link
                href="/dashboard"
                className="fr-recuadro border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
              >
                <span className="font-semibold text-fr-primary">Organizador</span>
                <span className="mt-1 block text-sm text-fr-muted">
                  {caps.organizations.map((o) => o.name).join(", ")}
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
