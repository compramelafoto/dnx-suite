import "server-only";
import type { Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { mensajeCandado, saldoPedidoMinor } from "./candado-saldo-puro";
import { saldoSinCargosMinor } from "./cargos-puro";
import { imputadoPorCuota } from "./estado";
import { bloquearPedido, planesDe } from "./plan";

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
  // Los extras opcionales sin pagar (descargas, extensión o envío de Digitalización) no frenan la
  // entrega del trabajo: el cliente ya pagó lo que contrató.
  const pedido = await saldoSinExtrasOpcionales(tx, workspaceId, pedidoId);
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

/**
 * El saldo del pedido sin los cargos extra OPCIONALES de Digitalización (descarga extra, extensión,
 * envío de cassettes), en cualquier estado del cargo: un extra pedido y no pagado (o cuyo cobro se
 * anuló) no traba ni los videos ya pagados ni la entrega del trabajo. A cada cuota de cargo se le
 * resta lo que le falta, con tope en el monto del cargo (`saldoSinCargosMinor`): lo que la cuota haya
 * absorbido de más (un plan editado a mano) sigue contando. Lo usan la página de videos, la descarga
 * contada, el correo «Tus videos están listos» y el candado de los trabajos (motor y ficha).
 */
export async function saldoSinExtrasOpcionales(db: Tx, workspaceId: string, pedidoId: string): Promise<{ numero: string; saldoMinor: number } | null> {
  const saldo = await saldoDelPedido(db, workspaceId, pedidoId);
  if (!saldo || saldo.saldoMinor === 0) return saldo;
  const cargos = await db.digitalizacionCargo.findMany({ where: { workspaceId, pedidoId }, select: { cuotaId: true, montoArs: true } });
  if (cargos.length === 0) return saldo;
  const plan = (await planesDe(workspaceId, [pedidoId], db)).get(pedidoId) ?? { cuotas: [], imputaciones: [] };
  const imputado = imputadoPorCuota(plan.imputaciones);
  const cuotas = new Map(plan.cuotas.map((c) => [c.id, Math.round(c.amountArs * 100)]));
  return {
    numero: saldo.numero,
    saldoMinor: saldoSinCargosMinor(
      saldo.saldoMinor,
      cargos.map((c) => ({ montoMinor: decimalArsToMinor(c.montoArs), cuotaMinor: cuotas.get(c.cuotaId) ?? null, imputadoMinor: imputado.get(c.cuotaId) ?? 0 })),
    ),
  };
}
