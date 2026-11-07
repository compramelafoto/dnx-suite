import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { AGENDA_MODULE_KEY } from "@/lib/agenda/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { origenPublico } from "@/lib/turnos/correos";
import { leerAjustesTurnos } from "@/lib/turnos/publico";
import { AjustesTurnosForm } from "./ajustes-turnos";

export const dynamic = "force-dynamic";

/** Configuración → Agenda → Página de turnos: textos y reglas generales de la reserva en línea. */
export default async function PaginaDeTurnosConfig() {
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Página de turnos" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los turnos.</p>
      </div>
    );
  }
  const encendido = await isModuleEnabledForWorkspace(workspace.id, AGENDA_MODULE_KEY);
  const [ajustes, branding, tipos] = await Promise.all([
    leerAjustesTurnos(workspace.id),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { publicSlug: true } }),
    prisma.fotofficeCitaTipo.findMany({ where: { workspaceId: workspace.id, isActive: true }, select: { id: true, name: true, isBookable: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
  ]);
  const enlace = branding?.publicSlug ? `${origenPublico()}/w/${branding.publicSlug}/turnos` : null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Página de turnos" description="Tus clientes eligen el tipo de turno, el día y la hora, y lo reservan solos. Entra confirmado en tu Agenda." />
      {!encendido ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">Primero encendé el módulo Agenda en Configuración → Módulos.</p>
      ) : (
        <>
          {enlace ? (
            <p className="fo-card p-4 text-sm">
              Dirección pública:{" "}
              <a href={enlace} target="_blank" rel="noreferrer" className="break-all text-[var(--fo-accent)] hover:underline">
                {enlace}
              </a>
            </p>
          ) : null}
          <section className="fo-card divide-y divide-[var(--fo-border)] p-0" aria-label="Tipos de turno">
            {tipos.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  {t.name} {t.isBookable ? <span className="ml-2 rounded-full bg-[var(--fo-accent)] px-2 py-0.5 text-xs text-white">Publicado</span> : null}
                </span>
                <Link href={`/workspace/configuracion/agenda/tipos/${t.id}`} className="text-[var(--fo-accent)] hover:underline">
                  Configurar
                </Link>
              </div>
            ))}
          </section>
          <AjustesTurnosForm inicial={ajustes} />
        </>
      )}
    </div>
  );
}
