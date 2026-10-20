import "server-only";
import type { Prisma } from "@repo/db";
import { mensajeCandado, saldoPedidoMinor } from "./candado-saldo-puro";
import { bloquearPedido } from "./plan";

type Tx = Prisma.TransactionClient;

/**
 * Candado del saldo, del lado del servidor: el motor de recorridos lo consulta antes de dejar
 * un trabajo en una etapa de fase ENTREGADO o de cerrarlo como terminado. No tiene excepciones
 * (ni forzar, ni el Sistema, ni un administrador): la regla es que lo que se debe se cobra antes
 * de entregar.
 *
 * Devuelve el texto del rechazo, o null si el trabajo se puede entregar (no es un proyecto, no
 * está atado a un pedido, o el pedido no debe nada). Lo lanza `recorridos.ts`, que es dueño del
 * `Rechazo`: importarlo desde acá armaría un ciclo entre los dos módulos.
 *
 * Toma el candado del pedido (`bloquearPedido`, el mismo de cobrar y anular) antes de leer los
 * cobros: así un cobro anulado en paralelo no deja pasar una entrega con deuda.
 */
export async function exigirPedidoPagado(
  tx: Tx,
  workspaceId: string,
  journey: { subjectType: string; subjectId: string },
): Promise<string | null> {
  if (journey.subjectType !== "PROYECTO") return null;
  const proyecto = await tx.fotofficeProyecto.findFirst({
    where: { id: journey.subjectId, workspaceId },
    select: { pedidoId: true },
  });
  const pedidoId = proyecto?.pedidoId ?? null;
  if (pedidoId === null) return null;

  await bloquearPedido(tx, pedidoId);
  const pedido = await saldoDelPedido(tx, workspaceId, pedidoId);
  return pedido && pedido.saldoMinor > 0 ? mensajeCandado(pedido.numero, pedido.saldoMinor) : null;
}

/**
 * Número y saldo (centavos) de un pedido del workspace, o null si no existe. La misma cuenta que
 * el candado; la usa también la ficha del trabajo para avisar antes de que el motor lo rechace.
 * Sin candado del pedido: quien necesite leerlo bloqueado lo toma antes (`exigirPedidoPagado`).
 */
export async function saldoDelPedido(db: Tx, workspaceId: string, pedidoId: string): Promise<{ numero: string; saldoMinor: number } | null> {
  const pedido = await db.fotofficePedido.findFirst({
    where: { id: pedidoId, workspaceId },
    select: { number: true, totalArs: true, status: true },
  });
  if (!pedido) return null;
  const cobros = await db.fotofficeCobro.aggregate({
    where: { workspaceId, pedidoId, voidedAt: null },
    _sum: { amountArs: true },
  });
  return {
    numero: pedido.number,
    saldoMinor: saldoPedidoMinor({
      totalArs: Number(pedido.totalArs),
      cobradoArs: Number(cobros._sum.amountArs ?? 0),
      status: pedido.status,
    }),
  };
}
