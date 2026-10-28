import { PageHeader } from "@/components/page-header";
import { EditorFotoCarnet } from "@/components/foto-carnet/editor-foto-carnet";
import { requireFotoCarnet } from "@/lib/foto-carnet/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { asegurarConfiguracion, listarSalidas } from "@/lib/impresion/configuracion";

export const dynamic = "force-dynamic";

/**
 * Foto carnet suelta (sin venta): encuadrar una foto a la medida de un trámite y armar la
 * plancha. El navegador sólo guarda la receta; la plancha la arma el servidor desde el original,
 * en la impresora y la hoja que se elijan acá.
 */
export default async function FotoCarnetPage() {
  const { user, workspace } = await requireFotoCarnet();
  const clientes = await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY);
  const nivel = clientes ? await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY) : "NONE";
  await asegurarConfiguracion(workspace.id);
  const salidas = await listarSalidas(workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foto carnet"
        description="Encuadrá la foto a la medida del trámite, retocala e imprimí la plancha en la Kodak o la Epson."
      />
      <EditorFotoCarnet
        puedeBuscarClientes={hasLevel(nivel, "VIEW")}
        puedeAltaCliente={hasLevel(nivel, "MANAGE")}
        modo={{ tipo: "suelto", salidas }}
      />
    </div>
  );
}
