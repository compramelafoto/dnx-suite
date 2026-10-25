import "server-only";
import { prisma } from "@repo/db";
import { saldoSinExtrasOpcionales } from "@/lib/pedidos/candado-saldo";
import { candadoDeLaFicha, type CandadoFicha } from "./candado-ficha-puro";

/**
 * El candado del saldo para la ficha de un trabajo atado a un pedido: null si no debe nada (o el
 * pedido no existe). Sólo lee —acotado al workspace—; el que decide al mover es el motor. Con la
 * misma cuenta que el motor: los extras opcionales de Digitalización sin pagar no cuentan.
 */
export async function leerCandadoDeLaFicha(
  workspaceId: string,
  d: { pedidoId: string; circuitId: string; etapaActualId: string | null },
): Promise<CandadoFicha | null> {
  const pedido = await saldoSinExtrasOpcionales(prisma, workspaceId, d.pedidoId);
  if (!pedido || pedido.saldoMinor <= 0) return null;
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: d.circuitId, circuit: { workspaceId } },
    select: { id: true, name: true, color: true, order: true, archivedAt: true },
  });
  return candadoDeLaFicha({
    pedido,
    etapas: etapas.map((e) => ({ id: e.id, name: e.name, color: e.color, order: e.order, archivada: e.archivedAt !== null })),
    etapaActualId: d.etapaActualId,
  });
}
