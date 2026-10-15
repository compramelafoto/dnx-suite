import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { ORDERS_MODULE_KEY, puedeGestionarPedidos, veCostosDePedido } from "@/lib/pedidos/acceso";
import { asegurarAjustesPedidosDnx } from "@/lib/pedidos/ajustes";
import { listadoPedidos } from "@/lib/pedidos/listado";
import { requirePedidos } from "@/lib/pedidos/pagina";

export const dynamic = "force-dynamic";

/**
 * Lista de Pedidos (motor de listas 0.2): número, contacto, evento, estado, total, cobrado, saldo y
 * próximo vencimiento; filtros por estado, con saldo y con cuotas vencidas. Nunca muestra costos.
 * "Nuevo pedido" (con "Gestionar") lleva a elegir el contacto: el alta manual sale de su ficha.
 * "A pagar" (cuentas a pagar a proveedores) sólo para quien ve costos.
 */
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, ctx } = await requirePedidos("ver");
  // DNX Estudio arranca con el recordatorio de cuotas encendido (Entrega B1): la fila nace la primera
  // vez que alguien abre Pedidos o su configuración. Nunca pisa una fila; la tarea diaria no la crea.
  await asegurarAjustesPedidosDnx(workspace.id);
  const ctxListado = await contextoListadoDePagina(user, workspace, ORDERS_MODULE_KEY);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Los trabajos confirmados, con su plan de cuotas, lo cobrado y el saldo."
        actions={
          <div className="flex flex-wrap gap-2">
            {/* Informes y "A pagar" son dinero: sólo con `veCostosDePedido`. */}
            {veCostosDePedido(ctx) ? (
              <Link href="/pedidos/informes" className="fo-btn fo-btn-secondary text-sm">
                Informes
              </Link>
            ) : null}
            {/* "A pagar" es dinero de costos: sólo con `veCostosDePedido`. */}
            {veCostosDePedido(ctx) ? (
              <Link href="/pedidos/a-pagar" className="fo-btn fo-btn-secondary text-sm">
                A pagar
              </Link>
            ) : null}
            {puedeGestionarPedidos(ctx) ? (
              <Link href="/pedidos/nuevo" className="fo-btn fo-btn-primary text-sm">
                Nuevo pedido
              </Link>
            ) : null}
          </div>
        }
      />
      <Listado def={listadoPedidos} ctx={ctxListado} ruta="/pedidos" searchParams={searchParams} />
    </div>
  );
}
