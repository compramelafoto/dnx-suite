import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { ORDERS_MODULE_KEY, puedeGestionarPedidos } from "@/lib/pedidos/acceso";
import { listadoPedidos } from "@/lib/pedidos/listado";
import { requirePedidos } from "@/lib/pedidos/pagina";

export const dynamic = "force-dynamic";

/**
 * Lista de Pedidos (motor de listas 0.2): número, contacto, evento, estado, total, cobrado, saldo y
 * próximo vencimiento; filtros por estado, con saldo y con cuotas vencidas. Nunca muestra costos.
 * "Nuevo pedido" (con "Gestionar") lleva a elegir el contacto: el alta manual sale de su ficha.
 */
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, ctx } = await requirePedidos("ver");
  const ctxListado = await contextoListadoDePagina(user, workspace, ORDERS_MODULE_KEY);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Los trabajos confirmados, con su plan de cuotas, lo cobrado y el saldo."
        actions={
          puedeGestionarPedidos(ctx) ? (
            <Link href="/pedidos/nuevo" className="fo-btn fo-btn-primary text-sm">
              Nuevo pedido
            </Link>
          ) : null
        }
      />
      <Listado def={listadoPedidos} ctx={ctxListado} ruta="/pedidos" searchParams={searchParams} />
    </div>
  );
}
