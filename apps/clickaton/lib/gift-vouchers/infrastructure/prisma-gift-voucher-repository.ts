import { prisma } from "@repo/db";
import type { GiftVoucherRepository } from "../domain/repository";
import type { GiftVoucherRecord } from "../domain/types";

type Row = NonNullable<
  Awaited<ReturnType<typeof prisma.clickatonGiftVoucher.findFirst>>
>;

function toRecord(row: Row): GiftVoucherRecord {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    editionId: row.editionId,
    registrationId: row.registrationId,
    buyerUserId: row.buyerUserId,
    buyerFirstName: row.buyerFirstName,
    buyerLastName: row.buyerLastName,
    buyerEmail: row.buyerEmail,
    buyerPhone: row.buyerPhone,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    giftMessage: row.giftMessage,
    paidAt: row.paidAt,
    redeemableUntil: row.redeemableUntil,
    redeemedAt: row.redeemedAt,
    cancelledAt: row.cancelledAt,
    carriedOverToEditionId: row.carriedOverToEditionId,
    carriedOverAt: row.carriedOverAt,
    reissueCount: row.reissueCount,
    recipientEmailSentAt: row.recipientEmailSentAt,
    recipientEmailCount: row.recipientEmailCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Las transiciones usan `updateMany` con el estado esperado en el `where`:
 * si el aviso de pago llega dos veces, la segunda no actualiza nada y
 * devolvemos la fila tal como quedó. Sin transacción ni bloqueo.
 */
export function createPrismaGiftVoucherRepository(): GiftVoucherRepository {
  async function reload(voucherId: string): Promise<GiftVoucherRecord> {
    const row = await prisma.clickatonGiftVoucher.findUniqueOrThrow({
      where: { id: voucherId },
    });
    return toRecord(row);
  }

  return {
    async create(cmd) {
      const row = await prisma.clickatonGiftVoucher.create({ data: { ...cmd } });
      return toRecord(row);
    },

    async findByCode(code) {
      const row = await prisma.clickatonGiftVoucher.findUnique({ where: { code } });
      return row ? toRecord(row) : null;
    },

    async findByRegistrationId(registrationId) {
      const row = await prisma.clickatonGiftVoucher.findUnique({
        where: { registrationId },
      });
      return row ? toRecord(row) : null;
    },

    async markPaid({ voucherId, paidAt, redeemableUntil }) {
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: "PENDING_PAYMENT" },
        data: { status: "ACTIVE", paidAt, redeemableUntil },
      });
      return reload(voucherId);
    },

    async markRedeemed({ voucherId, redeemedAt }) {
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: "ACTIVE" },
        data: { status: "REDEEMED", redeemedAt },
      });
      return reload(voucherId);
    },

    async markCancelled({ voucherId, cancelledAt, refunded }) {
      // Un voucher canjeado no se anula: la inscripción ya es de otra persona.
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: { not: "REDEEMED" } },
        data: { status: refunded ? "REFUNDED" : "CANCELLED", cancelledAt },
      });
      return reload(voucherId);
    },

    async markCarriedOver({ voucherId, carriedOverAt, carriedOverToEditionId }) {
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: "ACTIVE" },
        data: { status: "CARRIED_OVER", carriedOverAt, carriedOverToEditionId },
      });
      return reload(voucherId);
    },

    async listCarryOverCandidates(limit) {
      const rows = await prisma.clickatonGiftVoucher.findMany({
        where: {
          status: "ACTIVE",
          redeemableUntil: { not: null, lt: new Date() },
        },
        orderBy: { redeemableUntil: "asc" },
        take: limit,
      });
      return rows.map(toRecord);
    },

    async reissueCode({ voucherId, newCode }) {
      const row = await prisma.clickatonGiftVoucher.update({
        where: { id: voucherId },
        data: { code: newCode, reissueCount: { increment: 1 } },
      });
      return toRecord(row);
    },
  };
}
