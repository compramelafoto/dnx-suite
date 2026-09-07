import "server-only";
import type { Prisma } from "@repo/db";

/**
 * Qué pasa con la deuda cuando se anula un pedido de tarjeta impresa.
 *
 * Anular es deshacer un pedido, y un pedido deshecho no se cobra. Hasta que esto existió, el
 * estado del carnet y el cargo vivían separados: la Secretaría anulaba el pedido, el socio
 * seguía debiendo la credencial, y con dos anulaciones debía dos tarjetas que nunca existieron.
 *
 * Corre DENTRO de la transacción que cambia el estado —por eso recibe el cliente y no lo abre
 * él—: un carnet anulado con su cargo todavía vivo es exactamente el estado intermedio que
 * este módulo viene a impedir.
 */
export type VoidedChargeOutcome = "BORRADO" | "CONSERVADO" | "SIN_CARGO";

export async function releaseVoidedPrintOrderCharge(
  tx: Prisma.TransactionClient,
  cardId: string,
): Promise<VoidedChargeOutcome> {
  const card = await tx.memberCard.findUnique({
    where: { id: cardId },
    select: { printOrderChargeId: true },
  });
  const chargeId = card?.printOrderChargeId;
  if (!chargeId) return "SIN_CARGO";

  const imputaciones = await tx.membershipAllocation.count({ where: { chargeId } });
  if (imputaciones > 0) {
    // Ya se pagó. Borrarlo dejaría un pago imputado a un cargo inexistente y rompería la
    // conciliación; además la plata es del socio, no de la institución. El cargo queda
    // enganchado a este pedido anulado y la próxima tarjeta lo reutiliza sin volver a cobrar.
    return "CONSERVADO";
  }

  await tx.membershipCharge.delete({ where: { id: chargeId } });
  // El carnet deja de apuntar a un cargo que ya no existe: `printOrderChargeId` no tiene una
  // clave foránea que lo limpie sola, y un puntero colgado confunde a cualquiera que lo lea.
  await tx.memberCard.update({ where: { id: cardId }, data: { printOrderChargeId: null } });
  return "BORRADO";
}
