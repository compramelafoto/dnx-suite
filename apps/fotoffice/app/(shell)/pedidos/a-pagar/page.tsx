import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { ORDERS_MODULE_KEY, veCostosDePedido } from "@/lib/pedidos/acceso";
import { listadoAPagar } from "@/lib/pedidos/listado-a-pagar";
import { requirePedidos } from "@/lib/pedidos/pagina";

export const dynamic = "force-dynamic";

/**
 * "A pagar" (Entrega B1): las cuentas a pagar a proveedores de todos los pedidos, con proveedor,
 * concepto, pedido, vencimiento, importe y estado; filtros por situación (vencidas, próximos 30
 * días, pendientes, pagadas) y por proveedor. Es todo dinero de costos: sólo con
 * `veCostosDePedido` (`configurar` o `verDinero`); el resto ve un aviso y nada más.
 */
export default async function APagarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, ctx } = await requirePedidos("ver");
  const volver = (
    <Link href="/pedidos" className="fo-btn fo-btn-secondary text-sm">
      Volver a Pedidos
    </Link>
  );
  if (!veCostosDePedido(ctx)) {
    return (
      <div className="space-y-6">
        <PageHeader title="A pagar" description="Las cuentas a pagar a proveedores de los pedidos." actions={volver} />
        <p className="fo-card text-sm text-[var(--fo-muted)]">
          No tenés permiso para ver los costos de los pedidos. Pedíselo a quien administra la organización.
        </p>
      </div>
    );
  }
  const ctxListado = await contextoListadoDePagina(user, workspace, ORDERS_MODULE_KEY);
  return (
    <div className="space-y-6">
      <PageHeader
        title="A pagar"
        description="Las cuentas a pagar a proveedores de los pedidos: se pagan y se anulan desde la ficha de cada pedido."
        actions={volver}
      />
      <Listado def={listadoAPagar} ctx={ctxListado} ruta="/pedidos/a-pagar" searchParams={searchParams} />
    </div>
  );
}
