import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { CONTRACTS_MODULE_KEY } from "@/lib/contratos/acceso";
import { listadoContratos } from "@/lib/contratos/listado";
import { requireContratos } from "@/lib/contratos/requerir";
import { contextoListadoDePagina } from "@/lib/listado/acceso";

export const dynamic = "force-dynamic";

/**
 * Lista de Contratos (motor de listas 0.2): número, contacto, pedido, estado, fecha de envío y de firma;
 * filtro por estado. Los contratos se generan desde la ficha del pedido y se trabajan en su propia ficha.
 */
export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireContratos("ver");
  const ctx = await contextoListadoDePagina(user, workspace, CONTRACTS_MODULE_KEY);
  return (
    <div className="space-y-6">
      <PageHeader title="Contratos" description="Los contratos de cada pedido: borradores, enviados a firmar, firmados y anulados." />
      <Listado def={listadoContratos} ctx={ctx} ruta="/contratos" searchParams={searchParams} />
    </div>
  );
}
