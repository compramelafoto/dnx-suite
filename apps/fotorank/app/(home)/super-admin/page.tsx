import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  openContestAsSuperAdminAction,
  startActAsOrganizerAction,
  startActAsUiContextAction,
} from "../../actions/super-admin-context";
import { requireAuth } from "../../lib/auth";
import {
  getActAsOrganizationId,
  getSuperAdminUiContext,
  userIsFotorankSuperAdmin,
} from "../../lib/fotorank/access/super-admin";
import { routes } from "../../lib/routes";

/**
 * Panel Super Admin — acceso global sin membresía por concurso.
 */
export default async function SuperAdminPage() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }

  const [actAsOrgId, uiContext] = await Promise.all([
    getActAsOrganizationId(),
    getSuperAdminUiContext(),
  ]);

  const [organizations, contests, usersCount, registrationsCount, entriesCount, recentAudit] =
    await Promise.all([
      prisma.contestOrganization.findMany({
        orderBy: { name: "asc" },
        take: 80,
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { contests: true, members: true } },
        },
      }),
      prisma.fotorankContest.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.user.count(),
      prisma.fotorankContestRegistration.count(),
      prisma.fotorankContestEntry.count(),
      prisma.fotorankPlatformAuditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          organizationId: true,
          contestId: true,
          createdAt: true,
          ip: true,
        },
      }),
    ]);

  return (
    <div className="space-y-12" data-testid="super-admin-panel">
      <header className="space-y-4">
        <p className="fr-eyebrow text-gold">Super Administración</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">
          Administración global
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-fr-muted">
          Acceso a todas las organizaciones y concursos sin pertenecer como organizador.
          Usá «Actuar como…» para ver la UI correspondiente con la misma cuenta (sin impersonar
          otra identidad ni mutar permisos).
        </p>
        {uiContext || actAsOrgId ? (
          <p className="text-sm text-amber-200/90" data-testid="super-admin-act-as-active">
            Contexto activo: {uiContext ?? "organizer"}
            {actAsOrgId ? ` · org ${actAsOrgId}` : ""}. Toda acción sigue auditada como Super Admin.
          </p>
        ) : null}
      </header>

      <section className="space-y-4" data-testid="super-admin-modules">
        <h2 className="text-2xl font-semibold tracking-tight">Módulos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={routes.superAdmin.consignas()}
            className="fr-recuadro border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
            data-testid="super-admin-module-consignas"
          >
            <p className="fr-eyebrow text-gold">Biblioteca</p>
            <p className="mt-3 font-semibold text-fr-primary">Biblioteca de Consignas</p>
            <p className="mt-2 text-sm leading-relaxed text-fr-muted">
              Catálogo global editorial: borradores, revisión, aprobación y uso en ediciones.
            </p>
          </Link>
        </div>
      </section>

      <section className="space-y-6" data-testid="super-admin-act-as">
        <h2 className="text-2xl font-semibold tracking-tight">Actuar como</h2>
        <p className="text-sm text-fr-muted">
          Cambia solo el contexto de interfaz. No crea sesiones falsas ni altera membresías.
        </p>
        <div className="flex flex-wrap gap-4">
          <form action={startActAsUiContextAction}>
            <input type="hidden" name="context" value="participant" />
            <button type="submit" className="fr-btn fr-btn-secondary px-5 py-3 text-sm">
              Actuar como participante
            </button>
          </form>
          <form action={startActAsUiContextAction}>
            <input type="hidden" name="context" value="jury" />
            <button type="submit" className="fr-btn fr-btn-secondary px-5 py-3 text-sm">
              Actuar como jurado
            </button>
          </form>
          {organizations[0] ? (
            <form action={startActAsOrganizerAction}>
              <input type="hidden" name="organizationId" value={organizations[0].id} />
              <button type="submit" className="fr-btn fr-btn-secondary px-5 py-3 text-sm">
                Actuar como organizador (primera org)
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="super-admin-kpis">
        {[
          ["Organizaciones", organizations.length],
          ["Concursos", contests.length],
          ["Usuarios", usersCount],
          ["Inscripciones", registrationsCount],
          ["Fotografías (entries)", entriesCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="text-xs uppercase tracking-wide text-fr-muted">{label}</p>
            <p className="mt-4 text-3xl font-semibold text-gold">{value}</p>
          </div>
        ))}
      </section>

      <section id="organizaciones" className="space-y-6 scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Organizaciones</h2>
        <p className="text-sm text-fr-muted">
          Gestión de organizaciones · Actuar como organizador (impersonación de contexto).
        </p>
        <ul className="space-y-4">
          {organizations.map((org) => (
            <li
              key={org.id}
              className="fr-recuadro flex flex-wrap items-center justify-between gap-4 border border-fr-border bg-fr-card"
            >
              <div>
                <p className="font-semibold text-fr-primary">{org.name}</p>
                <p className="mt-2 text-sm text-fr-muted">
                  /{org.slug} · {org._count.contests} concursos · {org._count.members} miembros
                </p>
              </div>
              <form action={startActAsOrganizerAction}>
                <input type="hidden" name="organizationId" value={org.id} />
                <button type="submit" className="fr-btn fr-btn-primary px-5 py-3 text-sm">
                  Actuar como organizador
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="concursos" className="space-y-6 scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Concursos</h2>
        <p className="text-sm text-fr-muted">
          Inscripciones · Admisión · Jurado · Resultados · Configuración · Bases · Landing.
        </p>
        <ul className="space-y-4">
          {contests.map((c) => (
            <li
              key={c.id}
              className="fr-recuadro flex flex-wrap items-center justify-between gap-4 border border-fr-border bg-fr-card"
            >
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-2 text-sm text-fr-muted">
                  {c.organization.name} · /{c.slug}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-fr-muted">{c.status}</span>
                <form action={openContestAsSuperAdminAction}>
                  <input type="hidden" name="contestId" value={c.id} />
                  <button type="submit" className="fr-btn fr-btn-primary px-5 py-3 text-sm">
                    Abrir como admin
                  </button>
                </form>
                <Link
                  href={routes.dashboard.concursos.detalle(c.id)}
                  className="fr-btn fr-btn-secondary px-5 py-3 text-sm"
                >
                  Ir directo
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="usuarios" className="space-y-6 scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Usuarios</h2>
        <div className="fr-recuadro border border-fr-border bg-fr-card">
          <p className="text-sm leading-relaxed text-fr-muted">
            Cuentas DNX totales:{" "}
            <span className="font-semibold text-fr-primary">{usersCount}</span>. El rol global se
            gestiona con <code className="text-gold">grantGlobalRole</code> /{" "}
            <code className="text-gold">ensureGlobalSuperAdmin</code> (@repo/auth).
          </p>
        </div>
      </section>

      <section id="config" className="space-y-6 scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Configuración global</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Categorías", "/categorias"],
              ["Jurados / directorio", "/jurados/directorio"],
              ["Config institucional (contexto activo)", "/dashboard/settings"],
              ["Bases / consentimientos", "/super-admin#concursos"],
              ["Emails / notificaciones", "/super-admin#logs"],
              ["Autenticación (env / OAuth)", "/super-admin#config"],
            ] as const
          ).map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="fr-recuadro border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
            >
              <span className="font-semibold text-fr-primary">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="logs" className="space-y-6 scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Logs y auditoría</h2>
        <ul className="space-y-3" data-testid="super-admin-audit-list">
          {recentAudit.length === 0 ? (
            <li className="fr-recuadro border border-fr-border bg-fr-card text-sm text-fr-muted">
              Todavía no hay eventos de plataforma registrados.
            </li>
          ) : (
            recentAudit.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-fr-border bg-fr-card px-5 py-4 text-sm"
              >
                <span className="font-medium text-fr-primary">{e.action}</span>
                <span className="mt-2 block text-fr-muted">
                  {e.createdAt.toISOString()}
                  {e.ip ? ` · IP ${e.ip}` : ""}
                  {e.organizationId ? ` · org ${e.organizationId}` : ""}
                  {e.contestId ? ` · contest ${e.contestId}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
