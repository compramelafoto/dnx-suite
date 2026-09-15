import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import {
  listMyApplications,
  listMyPendingAssignments,
  listOpenCallsForPortal,
  loadCollaboratorProfile,
} from "@/lib/coverages/repository";
import { perfilHabilitado } from "@/lib/coverages/colaboradores";
import { lugaresLibres, type EstadoDeRol } from "@/lib/coverages/cupos";
import { ASSIGNMENT_LIVE_STATUSES, applicationStatusLabel } from "@/lib/coverages/states";
import { fechaArgentina, fechaHoraArgentina } from "@/lib/coverages/format";

export const dynamic = "force-dynamic";

/**
 * El portal del voluntario: tres bloques, en el orden que pide el plan.
 *
 * 1. Tus invitaciones — van primero porque tienen plazo. No se muestra el bloque si no hay
 *    ninguna: un bloque vacío al principio de la pantalla no aporta nada y compite por
 *    atención con lo que sí importa.
 * 2. Convocatorias abiertas.
 * 3. Tus postulaciones.
 *
 * El enlace de cada invitación lleva a `/portal/coberturas/asignacion/[id]`, que es donde se
 * contesta y donde —solo ahí— se muestra el `privateBriefing` de la convocatoria.
 */
export default async function PortalCoberturasPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, COVERAGES_MODULE_KEY))) {
    redirect("/portal");
  }

  const perfil = await loadCollaboratorProfile({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
  });

  // La llave de todo este portal (ver el plan): sin perfil de colaborador activo, no hay nada
  // que mostrar acá, y se lo decimos con amabilidad en vez de una lista vacía sin explicación.
  if (!perfilHabilitado(perfil)) {
    return (
      <div className="space-y-6">
        <Header />
        <section className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          Todavía no estás habilitado para anotarte a una cobertura. Hablá con la coordinación
          si querés sumarte como voluntario.
        </section>
      </div>
    );
  }

  const [invitaciones, convocatorias, postulaciones] = await Promise.all([
    listMyPendingAssignments({ workspaceId: context.workspace.id, memberId: context.member.id }),
    listOpenCallsForPortal({ workspaceId: context.workspace.id }),
    listMyApplications({ workspaceId: context.workspace.id, memberId: context.member.id }),
  ]);

  return (
    <div className="space-y-8">
      <Header />

      {invitaciones.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tus invitaciones</h2>
          <ul className="space-y-3">
            {invitaciones.map((a) => (
              <li key={a.id} className="fo-card space-y-2 p-4">
                <p className="font-medium">
                  {a.role.name} — {a.coverage.title}
                </p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {fechaHoraArgentina(a.coverage.startsAt)}
                  {a.coverage.city ? ` · ${a.coverage.city}` : ""}
                </p>
                <p className="text-sm">Te invitamos a participar y esperamos tu respuesta.</p>
                <Link
                  href={`/portal/coberturas/asignacion/${a.id}`}
                  className="fo-btn fo-btn-primary min-h-11 text-sm"
                >
                  Ver y responder
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Convocatorias abiertas</h2>
        {convocatorias.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
            Por ahora no hay ninguna convocatoria abierta. Cuando se publique una la vas a ver
            acá.
          </p>
        ) : (
          <ul className="space-y-3">
            {convocatorias.map((c) => {
              const estados: EstadoDeRol[] = c.coverage.roles.map((r) => ({
                vacancies: r.vacancies,
                asignadasVivas: r.assignments.filter((a) =>
                  (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
                ).length,
                asignadasAceptadas: 0, // no hace falta acá: esta lista solo cuenta lugares libres
              }));
              const libres = estados.reduce((total, e) => total + lugaresLibres(e), 0);
              return (
                <li key={c.id} className="fo-card space-y-2 p-4">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    {fechaArgentina(c.coverage.startsAt)}
                    {c.coverage.city ? ` · ${c.coverage.city}` : ""}
                  </p>
                  <p className="text-sm">
                    {libres > 0
                      ? `${libres} ${libres === 1 ? "lugar libre" : "lugares libres"}`
                      : "El equipo ya está completo, pero podés anotarte como suplente."}
                  </p>
                  <Link
                    href={`/portal/coberturas/${c.id}`}
                    className="fo-btn fo-btn-primary min-h-11 text-sm"
                  >
                    Ver y anotarme
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tus postulaciones</h2>
        {postulaciones.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no te anotaste a ninguna.</p>
        ) : (
          <ul className="space-y-3">
            {postulaciones.map((p) => (
              <li key={p.id} className="fo-card space-y-1 p-4">
                <p className="font-medium">
                  {p.role.name} — {p.call.title}
                </p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {fechaArgentina(p.call.coverage.startsAt)}
                  {p.call.coverage.city ? ` · ${p.call.coverage.city}` : ""}
                </p>
                <p className="text-sm">{applicationStatusLabel(p.status)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Coberturas</h1>
      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        Anotate como voluntario a las actividades que necesitan gente.
      </p>
    </header>
  );
}
