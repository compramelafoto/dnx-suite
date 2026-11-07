import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { AGENDA_MODULE_KEY } from "@/lib/agenda/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { leerConfigTurnoTipo } from "@/lib/turnos/configurar";
import { origenPublico } from "@/lib/turnos/correos";
import { ConfigTurno } from "./config-turno";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tipoId: string }> };

/** Configuración → Agenda → Tipos de cita → un tipo: publicarlo como turno que el cliente reserva solo. */
export default async function ConfigTurnoTipoPage({ params }: Props) {
  const { tipoId } = await params;
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) notFound();
  if (!(await isModuleEnabledForWorkspace(workspace.id, AGENDA_MODULE_KEY))) notFound();
  const config = await leerConfigTurnoTipo(workspace.id, tipoId);
  if (!config) notFound();
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { publicSlug: true } });
  const enlace = branding?.publicSlug ? `${origenPublico()}/w/${branding.publicSlug}/turnos/${tipoId}` : null;
  const { name, ...inicial } = config;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/workspace/configuracion/agenda/tipos" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Tipos de cita
      </Link>
      <PageHeader title={`Turnos online: ${name}`} description="Publicalo para que tus clientes elijan día y hora solos. El turno entra confirmado en tu Agenda y te llega un correo." />
      <ConfigTurno tipoId={tipoId} inicial={inicial} enlacePublico={enlace} />
      <p className="text-sm text-[var(--fo-muted)]">
        La anticipación, el plazo para cancelar y el texto de la página se configuran en{" "}
        <Link href="/workspace/configuracion/agenda/turnos" className="text-[var(--fo-accent)] hover:underline">
          Página de turnos
        </Link>
        .
      </p>
    </div>
  );
}
