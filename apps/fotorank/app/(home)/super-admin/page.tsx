import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  openContestAsSuperAdminAction,
  startActAsOrganizerAction,
} from "../../actions/super-admin-context";
import { requireAuth } from "../../lib/auth";
import {
  getActAsOrganizationId,
  userIsFotorankSuperAdmin,
} from "../../lib/fotorank/access/super-admin";
import { routes } from "../../lib/routes";
import { contarJuradosPendientes } from "../../actions/judgeDirectoryReview";
import { fechaExacta, tiempoRelativo } from "../../lib/fotorank/judges/ui/tiempoRelativo";

/**
 * Panel Super Admin — acceso global sin membresía por concurso.
 */
export default async function SuperAdminPage() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }

  const actAsOrgId = await getActAsOrganizationId();
  const juradosPendientes = await contarJuradosPendientes();
  const superAdmins = await prisma.user.findMany({
    where: { globalRole: "SUPER_ADMIN" },
    select: { id: true, name: true, email: true, lastLoginAt: true },
    orderBy: { email: "asc" },
    take: 20,
  });

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
          Usá «Actuar como…» para ver exactamente la UI de un organizador (sin cambiar la base de
          datos).
        </p>
        {actAsOrgId ? (
          <p className="text-sm text-amber-200/90" data-testid="super-admin-act-as-active">
            Contexto activo: actuando como organizador de org {actAsOrgId}.
          </p>
        ) : null}
      </header>

      {juradosPendientes > 0 ? (
        /*
         * Una cola con gente esperando no es una estadística: es trabajo
         * pendiente, y como recuadro gris entre otros cinco no se veía.
         * Cuando la cola se vacía, este aviso desaparece solo.
         */
        <Link
          href="/super-admin/jurados"
          className="block rounded-xl border border-gold/40 bg-gold/5 px-6 py-5 transition-colors hover:border-gold/70"
          data-testid="super-admin-jurados-pendientes"
        >
          <p className="text-base font-semibold text-fr-primary">
            {juradosPendientes === 1
              ? "Hay 1 fotógrafo esperando que revises su ficha"
              : `Hay ${juradosPendientes} fotógrafos esperando que revises su ficha`}
          </p>
          <p className="mt-1 text-sm text-fr-muted">
            Se postularon al directorio de jurados y ya confirmaron su correo. Hasta que las
            apruebes, sus fichas no aparecen en ningún lado.
          </p>
        </Link>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="super-admin-kpis">
        {[
          ["Organizaciones", organizations.length],
          ["Concursos", contests.length],
          ["Usuarios", usersCount],
          ["Jurados por revisar", juradosPendientes, "/super-admin/jurados"],
          ["Inscripciones", registrationsCount],
          ["Fotografías (entries)", entriesCount],
        ].map(([label, value, href]) => {
          const recuadro = (
            <div className="fr-recuadro h-full border border-fr-border bg-fr-card">
              <p className="text-xs uppercase tracking-wide text-fr-muted">{label}</p>
              <p className="mt-4 text-3xl font-semibold text-gold">{value}</p>
            </div>
          );
          return href ? (
            <Link key={String(label)} href={String(href)} className="block transition-opacity hover:opacity-80">
              {recuadro}
            </Link>
          ) : (
            <div key={String(label)}>{recuadro}</div>
          );
        })}
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
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Usuarios</h2>
          <p className="mt-1 text-sm text-fr-muted">
            {usersCount === 1 ? "1 cuenta" : `${usersCount} cuentas`} en toda la suite DNX.
          </p>
        </div>

        <div className="fr-recuadro border border-fr-border bg-fr-card">
          <h3 className="text-sm font-semibold text-fr-primary">
            Quiénes administran la plataforma
          </h3>
          {superAdmins.length === 0 ? (
            <p className="mt-3 text-sm text-fr-muted">
              Nadie tiene acceso de administración. Es raro: si estás viendo esta pantalla,
              deberías figurar acá.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {superAdmins.map((u) => (
                <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-fr-primary">
                    {u.name?.trim() || u.email}
                    {u.name?.trim() ? (
                      <span className="ml-2 text-xs text-fr-muted">{u.email}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-fr-muted" title={fechaExacta(u.lastLoginAt)}>
                    Entró {tiempoRelativo(u.lastLoginAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-fr-muted">
            El acceso de administración se otorga desde la base, no desde esta pantalla.
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
