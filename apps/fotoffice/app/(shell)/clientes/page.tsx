import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { requireClientsStaff } from "@/lib/clients/access";
import { listadoClientes } from "@/lib/clients/listado";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { ContextoListado } from "@/lib/listado/tipos";

export const dynamic = "force-dynamic";
// Las acciones en lote (server actions) corren bajo la configuración de esta página.
export const maxDuration = 300;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, role } = await requireClientsStaff();
  const ctx: ContextoListado = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clientes"
        description="Padrón de clientes del negocio: ficha, contacto y datos fiscales."
        actions={
          <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
            Nuevo cliente
          </Link>
        }
      />
      <Listado def={listadoClientes} ctx={ctx} ruta="/clientes" searchParams={searchParams} />
    </div>
  );
}
