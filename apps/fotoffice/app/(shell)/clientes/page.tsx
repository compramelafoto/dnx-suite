import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { requireClientsViewer } from "@/lib/clients/access";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { cargarListadoClientes } from "@/lib/clients/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";

export const dynamic = "force-dynamic";
// Las acciones en lote (server actions) corren bajo la configuración de esta página.
export const maxDuration = 300;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Ver el padrón pide VIEW en Clientes; crear y las acciones en lote, MANAGE (`canEdit`).
  const { user, workspace, canEdit } = await requireClientsViewer();
  const [ctx, total] = await Promise.all([
    contextoListadoDePagina(user, workspace, CLIENTS_MODULE_KEY),
    prisma.client.count({ where: { workspaceId: workspace.id } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clientes"
        description="Padrón de clientes del negocio: ficha, contacto y datos fiscales."
        actions={
          canEdit ? (
            <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
              Nuevo cliente
            </Link>
          ) : undefined
        }
      />
      {total === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay clientes cargados</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Cargá el primero con su nombre, su contacto y —si hace falta facturarle— sus
              datos fiscales.
            </p>
          </div>
          {canEdit ? (
            <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
              Crear el primer cliente
            </Link>
          ) : null}
        </div>
      ) : (
        <Listado def={await cargarListadoClientes(ctx)} ctx={ctx} ruta="/clientes" searchParams={searchParams} />
      )}
    </div>
  );
}
