import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { veCostosDePedido } from "@/lib/pedidos/acceso";
import { requirePedidos } from "@/lib/pedidos/pagina";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Una cuenta a pagar no tiene ficha propia: la fila de "A pagar" lleva a la sección "Costos y
 * pagos" de su pedido. Sólo con `veCostosDePedido` y dentro del workspace de la sesión.
 */
export default async function CuentaAPagarPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace, ctx } = await requirePedidos("ver");
  const { id } = await params;
  if (!ID_VALIDO.test(id) || !veCostosDePedido(ctx)) notFound();
  const c = await prisma.fotofficeCuentaPagar.findFirst({ where: { id, workspaceId: workspace.id }, select: { pedidoId: true } });
  if (!c) notFound();
  redirect(c.pedidoId ? `/pedidos/${encodeURIComponent(c.pedidoId)}#costos` : "/pedidos/a-pagar");
}
