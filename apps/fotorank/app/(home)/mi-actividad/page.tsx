import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "../../lib/auth";
import {
  resolveHomeCapabilities,
  resolvePostLoginPath,
} from "../../lib/fotorank/access/home-capabilities";
import { routes } from "../../lib/routes";

export default async function MiActividadPage() {
  const user = await requireAuth();
  const caps = await resolveHomeCapabilities({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  // Una sola capacidad → ir directo al panel (salvo visita explícita multi / vacío).
  if (caps.kinds.length === 1 && caps.kinds[0] !== "superAdmin") {
    const dest = resolvePostLoginPath(caps);
    if (dest !== "/mi-actividad") redirect(dest);
  }

  return (
    <div className="space-y-10" data-testid="mi-actividad-hub">
      <header className="space-y-4">
        <p className="fr-eyebrow text-gold">Mi actividad</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">
          Hola{user.name?.trim() ? `, ${user.name.trim().split(/\s+/)[0]}` : ""}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-fr-muted">
          Tu cuenta unifica participaciones, organizaciones y tareas. Abrí el bloque que
          necesites — sin elegir un “modo de ingreso”.
        </p>
      </header>

      {caps.kinds.length === 0 ? (
        <section className="fr-recuadro max-w-xl border border-fr-border bg-fr-card" data-testid="mi-actividad-empty">
          <h2 className="text-xl font-semibold tracking-tight">No tenés actividad todavía.</h2>
          <p className="mt-4 text-sm leading-relaxed text-fr-muted">
            Podés explorar concursos públicos e inscribirte, o esperar una invitación como
            organizador o jurado.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/" className="fr-btn fr-btn-primary inline-flex w-fit px-6 py-3">
              Explorar concursos
            </Link>
            <Link
              href="/concursos"
              className="fr-btn fr-btn-secondary inline-flex w-fit px-6 py-3"
            >
              Ver concursos abiertos
            </Link>
          </div>
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

      {caps.hasOrganizations ? (
        <section className="space-y-6" data-testid="section-organizaciones">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Organizaciones</h2>
            <p className="text-sm text-fr-muted">Mis concursos y panel organizador.</p>
          </div>
          <ul className="grid gap-8 md:grid-cols-2">
            {caps.organizations.map((org) => (
              <li key={org.id} className="fr-recuadro border border-fr-border bg-fr-card">
                <h3 className="text-lg font-semibold">{org.name}</h3>
                <p className="mt-4 text-sm text-fr-muted">/{org.slug}</p>
              </li>
            ))}
          </ul>
          {caps.organizerContests.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight">Mis concursos</h3>
              <ul className="space-y-4">
                {caps.organizerContests.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={routes.dashboard.concursos.detalle(c.id)}
                      className="flex items-center justify-between rounded-lg border border-fr-border bg-fr-card px-6 py-4 transition-colors hover:border-gold/40"
                    >
                      <span className="font-medium text-fr-primary">{c.title}</span>
                      <span className="text-xs text-fr-muted">{c.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link href="/dashboard" className="text-sm font-medium text-gold hover:text-gold-hover">
            Ir al Dashboard Organizador →
          </Link>
        </section>
      ) : null}

      {caps.hasJuryAccount ? (
        <section className="space-y-6" data-testid="section-jurado">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Tareas de jurado</h2>
            <p className="text-sm text-fr-muted">
              Solo concursos donde fuiste invitado. El panel de evaluación usa la sesión de jurado.
            </p>
          </div>
          {caps.juryContests.length === 0 ? (
            <div className="fr-recuadro border border-fr-border bg-fr-card">
              <p className="text-sm text-fr-muted">Tenés cuenta de jurado sin asignaciones activas.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {caps.juryContests.map((c) => (
                <li key={c.contestId}>
                  <Link
                    href={`/jurado/concursos/${c.contestId}`}
                    className="flex items-center justify-between rounded-lg border border-fr-border bg-fr-card px-6 py-4 transition-colors hover:border-gold/40"
                  >
                    <span className="font-medium">{c.title}</span>
                    <span className="text-xs text-gold">Evaluar</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/jurado/panel"
            className="text-sm font-medium text-gold hover:text-gold-hover"
          >
            Abrir panel de jurado →
          </Link>
        </section>
      ) : null}

      {caps.isSuperAdmin ? (
        <section className="space-y-6" data-testid="section-super-admin">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Super Administración</h2>
            <p className="text-sm text-fr-muted">
              Organizaciones, concursos, usuarios y configuraciones globales.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Organizaciones", "/super-admin#organizaciones"],
                ["Concursos", "/super-admin#concursos"],
                ["Usuarios", "/super-admin#usuarios"],
                ["Configuraciones globales", "/super-admin#config"],
              ] as const
            ).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="fr-recuadro border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
              >
                <span className="font-semibold text-fr-primary">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
