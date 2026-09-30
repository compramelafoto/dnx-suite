import { redirect } from "next/navigation";
import { ArmazonCaptacion } from "@/components/captacion/armazon";
import { Listado } from "@/components/listado/listado";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { ContextoListado } from "@/lib/listado/tipos";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { listadoCaptacion } from "@/lib/service-leads/listado";
import { prepararCaptacion } from "@/lib/service-leads/preparar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function CaptacionListaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  const ctx: ContextoListado = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  };
  const { quedan } = await prepararCaptacion(workspace.id);

  return (
    <ArmazonCaptacion activa="lista" quedan={quedan}>
      <Listado def={listadoCaptacion} ctx={ctx} ruta="/captacion/lista" searchParams={searchParams} />
    </ArmazonCaptacion>
  );
}
