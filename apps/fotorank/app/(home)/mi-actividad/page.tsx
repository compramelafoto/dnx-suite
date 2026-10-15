import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "../../lib/auth";
import { resolveHomeCapabilities } from "../../lib/fotorank/access/home-capabilities";
import { routes } from "../../lib/routes";

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
          Tus inscripciones y las fotos que enviaste a cada concurso.
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
        <section className="space-y-6" data-testid="section-participaciones">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Participaciones</h2>
            <p className="text-sm text-fr-muted">Mis inscripciones, estado y fotografías.</p>
          </div>
          <ul className="grid gap-8 md:grid-cols-2">
            {caps.participations.slice(0, 6).map((p) => (
              <li key={p.id} className="fr-recuadro border border-fr-border bg-fr-card">
                <h3 className="text-lg font-semibold">{p.contestTitle}</h3>
                <p className="mt-4 text-sm text-fr-muted">
                  {p.registrationNumber} · {p.status}
                </p>
                <Link
                  href={routes.concursos.inscripcion(p.contestSlug)}
                  className="fr-btn fr-btn-primary mt-8 inline-flex px-5 py-3 text-sm"
                >
                  Continuar
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/participaciones" className="text-sm font-medium text-gold hover:text-gold-hover">
            Ver todas las participaciones →
          </Link>
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
