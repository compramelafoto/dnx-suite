import "server-only";
import { prisma } from "@repo/db";
import { PRINTED_CARD_PERIOD } from "@/lib/membership/approve";
import { releasePaidPrintOrders, requestPrintedCard } from "./print-order";

/**
 * Emite la credencial impresa que el socio ya pagó al asociarse.
 *
 * El cargo se cobra con la inscripción, en un solo pago, pero la tarjeta no se puede emitir
 * ahí: hace falta la foto y la foto se sube después. Esta función cierra ese hueco cuando la
 * foto por fin llega.
 *
 * Idempotente y silenciosa: si no pagó, si no la pidió, o si ya tiene una en curso, no hace
 * nada. La llama la subida de la foto, que no debe fallar por esto.
 */
export async function issuePrepaidPrintedCard(input: {
  workspaceId: string;
  memberId: string;
}): Promise<{ emitida: boolean }> {
  const cargo = await prisma.membershipCharge.findFirst({
    where: {
      memberId: input.memberId,
      workspaceId: input.workspaceId,
      concept: "OTRO",
      period: PRINTED_CARD_PERIOD,
    },
    select: { id: true, balanceArs: true },
  });
  // Sin cargo no la pidió; con saldo todavía no la pagó.
  if (!cargo || Number(cargo.balanceArs) > 0) return { emitida: false };

  const enCurso = await prisma.memberCard.findFirst({
    where: {
      memberId: input.memberId,
      format: "PRINTED",
      revokedAt: null,
      fulfillmentState: { notIn: ["ENTREGADO", "ANULADO"] },
    },
    select: { id: true },
  });
  if (enCurso) return { emitida: false };

  // Se engancha al cargo que ya pagó: crear uno nuevo sería cobrarle la tarjeta dos veces.
  const r = await requestPrintedCard({
    workspaceId: input.workspaceId,
    memberId: input.memberId,
    existingChargeId: cargo.id,
  });
  if (!r.ok) return { emitida: false };

  // Nace en PENDIENTE_PAGO por diseño, pero este cargo ya está saldado: se la pasa a la cola
  // de impresión por la misma vía que usa el webhook, para no tener dos reglas distintas.
  await releasePaidPrintOrders(input.memberId);
  return { emitida: true };
}
