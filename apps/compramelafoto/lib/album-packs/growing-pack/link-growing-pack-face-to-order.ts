import type { Prisma } from "@prisma/client";

/**
 * Ata la selfie guardada de la selección al pedido que se acaba de crear.
 * - Un pedido tiene a lo sumo una selfie (si el carrito trae dos packs que suman, queda la primera).
 * - Una selfie ya atada a un pedido pagado no se mueve; si estaba atada a uno sin pagar
 *   (pago abandonado), pasa al pedido nuevo.
 */
export async function linkGrowingPackFaceToOrder(
  tx: Prisma.TransactionClient,
  params: { orderId: number; selectionSessionIds: string[] }
): Promise<void> {
  if (params.selectionSessionIds.length === 0) return;
  const faces = await tx.growingPackFace.findMany({
    where: {
      selectionSessionId: { in: params.selectionSessionIds },
      biometricDeletedAt: null,
    },
    select: { id: true, selectionSessionId: true, order: { select: { status: true } } },
  });
  const ordered = params.selectionSessionIds
    .map((id) => faces.find((f) => f.selectionSessionId === id))
    .filter((f): f is (typeof faces)[number] => !!f && f.order?.status !== "PAID");
  const face = ordered[0];
  if (!face) return;
  await tx.growingPackFace.update({
    where: { id: face.id },
    data: { orderId: params.orderId },
  });
}
