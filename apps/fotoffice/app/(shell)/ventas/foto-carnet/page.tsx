import { PageHeader } from "@/components/page-header";
import { EditorFotoCarnet } from "@/components/foto-carnet/editor-foto-carnet";
import { requireSalesStaff } from "@/lib/sales/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";

export const dynamic = "force-dynamic";

/**
 * Foto carnet: encuadrar una foto a la medida de un trámite y armar la plancha para imprimir.
 * Todo el procesamiento es del navegador; el servidor sólo interviene si se guarda la plancha
 * en la ficha del cliente (con los permisos de los adjuntos de siempre).
 */
export default async function FotoCarnetPage() {
  const { user, workspace } = await requireSalesStaff();
  const clientes = await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY);
  const nivel = clientes ? await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY) : "NONE";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foto carnet"
        description="Encuadrá la foto a la medida del trámite, retocala y descargá la plancha lista para imprimir en una copia 10x15 o 13x18."
      />
      <EditorFotoCarnet
        puedeBuscarClientes={hasLevel(nivel, "VIEW")}
        puedeGuardarEnFicha={hasLevel(nivel, "MANAGE")}
        puedeAltaCliente={hasLevel(nivel, "MANAGE")}
      />
    </div>
  );
}
