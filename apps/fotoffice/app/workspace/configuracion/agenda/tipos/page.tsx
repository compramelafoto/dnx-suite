import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { AGENDA_MODULE_KEY } from "@/lib/agenda/acceso";
import { prepararAgenda } from "@/lib/agenda/pagina";
import { listarTipos } from "@/lib/agenda/tipos";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { TiposDeCita } from "./tipos-de-cita";

export const dynamic = "force-dynamic";

/**
 * Configuración → Agenda → Tipos de cita: nombre, color y orden de los tipos (Reunión con cliente, Evento…).
 * Permiso: `configurar` (dueño o administrador), antes de cualquier lectura. Un tipo no se borra: se da de
 * baja y deja de ofrecerse, pero las citas que ya lo tenían lo conservan.
 */
export default async function TiposDeCitaPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();

  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Tipos de cita" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los tipos de cita.</p>
      </div>
    );
  }

  const encendido = await isModuleEnabledForWorkspace(workspace.id, AGENDA_MODULE_KEY);
  if (encendido) await prepararAgenda(workspace.id);
  const acceso = await resolverAcceso(user.id, workspace.id);
  const tipos = encendido
    ? await listarTipos({ workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso }, { conBajas: true })
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Tipos de cita" description="Cada cita puede tener un tipo, que le da su color en el calendario." />
      {!encendido ? (
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Agenda todavía no está encendido. Para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      ) : (
        <TiposDeCita tipos={tipos} />
      )}
    </div>
  );
}
