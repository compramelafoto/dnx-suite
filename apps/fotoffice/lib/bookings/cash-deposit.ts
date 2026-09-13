import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

/**
 * Deposita en Caja el cobro de una reserva, si el workspace la tiene encendida.
 *
 * Una reserva se paga por dos caminos —Mercado Pago (`checkout.ts`) y transferencia
 * confirmada a mano (`lifecycle.ts`)— y los dos tienen que terminar en el mismo asiento.
 * Vive acá, aparte, para que esa decisión no se escriba dos veces y se termine desincronizando.
 *
 * Va DENTRO de la transacción de quien llama, igual que en cuotas: el pago y su asiento
 * nacen juntos o no nacen. Nunca lanza por falta de Caja o de configuración — eso lo decide
 * `resolveDepositTarget` de antemano, sin escribir nada.
 */
export async function depositBookingPayment(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    workspaceId: string;
    bookingId: string;
    memberId: string | null;
    spaceName: string;
    amountMinor: number;
    occurredAt: Date;
    paymentMethod: "MERCADO_PAGO" | "TRANSFERENCIA";
  },
): Promise<void> {
  // Sin importe no hay nada que asentar: una reserva "Sin cargo" no genera movimiento. Si
  // alguna vez una reserva llega pagada con importe 0 por fuera de ese camino conocido, dejamos
  // rastro de que el depósito se salteó a propósito y por qué — si no, nadie se entera de que
  // una reserva "pagada" nunca llegó al libro.
  if (input.amountMinor <= 0) {
    console.warn("[fotoffice][reservas] reserva pagada con importe <= 0, no se deposita en Caja", {
      bookingId: input.bookingId,
      workspaceId: input.workspaceId,
      amountMinor: input.amountMinor,
    });
    return;
  }

  // Por qué se pregunta si Caja está habilitada ANTES de tocar `cashAccount`/`cashCategory`:
  // esas tablas las trae una migración que en este repo se aplica a mano, después del deploy
  // del código (no hay `migrate deploy` automático). Si el código sale antes que la migración,
  // un `findMany` contra una tabla ausente rompe con un error de Postgres DENTRO de la
  // transacción de quien llama y voltea la confirmación del pago de la reserva completa — en
  // cualquier workspace, tenga o no Caja encendida. Cortar acá antes de cualquier consulta a
  // Caja hace que ese despliegue desordenado sea inofensivo.
  const cashEnabled = await isModuleEnabledForWorkspace(input.workspaceId, CASH_MODULE_KEY);
  if (!cashEnabled) return;

  // La ficha de cliente no cuelga de la reserva, sino del socio (si lo hay): `Client.memberId`
  // es único, así que a lo sumo hay una.
  const cliente = input.memberId
    ? await tx.client.findUnique({ where: { memberId: input.memberId }, select: { id: true } })
    : null;

  const destino = resolveDepositTarget({
    cashEnabled,
    paymentMethod: input.paymentMethod,
    accounts: await tx.cashAccount.findMany({
      where: { workspaceId: input.workspaceId, isActive: true },
      select: { id: true, name: true, kind: true, isDefault: true },
      orderBy: { order: "asc" },
    }),
    categories: await tx.cashCategory.findMany({
      where: { workspaceId: input.workspaceId, kind: "INGRESO", isActive: true },
      select: { id: true, name: true, kind: true },
    }),
    categoryName: "Alquiler de espacios",
  });

  if (!destino.ok) return;

  await recordCashMovement(tx, {
    workspaceId: input.workspaceId,
    accountId: destino.accountId,
    categoryId: destino.categoryId,
    clientId: cliente?.id ?? null,
    kind: "INGRESO",
    amountMinor: input.amountMinor,
    occurredAt: input.occurredAt,
    description: `Alquiler — ${input.spaceName}`,
    paymentMethod: input.paymentMethod,
    sourceModule: "bookings",
    sourceRef: input.bookingId,
  });
}
