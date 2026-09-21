import type { GiftVoucherRepository } from "../domain/repository";
import type { CreateGiftVoucherCommand, GiftVoucherRecord } from "../domain/types";

/** Implementación para pruebas. Misma semántica de idempotencia que Prisma. */
export function createInMemoryGiftVoucherRepository(): GiftVoucherRepository {
  const byId = new Map<string, GiftVoucherRecord>();
  let seq = 0;

  function get(voucherId: string): GiftVoucherRecord {
    const found = byId.get(voucherId);
    if (!found) throw new Error(`Voucher ${voucherId} no encontrado.`);
    return found;
  }

  function save(next: GiftVoucherRecord): GiftVoucherRecord {
    const saved = { ...next, updatedAt: new Date() };
    byId.set(saved.id, saved);
    return saved;
  }

  return {
    async create(cmd: CreateGiftVoucherCommand) {
      seq += 1;
      const now = new Date();
      const record: GiftVoucherRecord = {
        id: `gv_${seq}`,
        code: cmd.code,
        status: "PENDING_PAYMENT",
        editionId: cmd.editionId,
        registrationId: cmd.registrationId,
        buyerUserId: cmd.buyerUserId,
        buyerFirstName: cmd.buyerFirstName,
        buyerLastName: cmd.buyerLastName,
        buyerEmail: cmd.buyerEmail,
        buyerPhone: cmd.buyerPhone,
        recipientName: cmd.recipientName,
        recipientEmail: cmd.recipientEmail,
        giftMessage: cmd.giftMessage,
        paidAt: null,
        redeemableUntil: null,
        redeemedAt: null,
        cancelledAt: null,
        carriedOverToEditionId: null,
        carriedOverAt: null,
        reissueCount: 0,
        recipientEmailSentAt: null,
        recipientEmailCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      return record;
    },

    async findByCode(code) {
      for (const record of byId.values()) {
        if (record.code === code) return record;
      }
      return null;
    },

    async findByRegistrationId(registrationId) {
      for (const record of byId.values()) {
        if (record.registrationId === registrationId) return record;
      }
      return null;
    },

    async markPaid({ voucherId, paidAt, redeemableUntil }) {
      const current = get(voucherId);
      if (current.status !== "PENDING_PAYMENT") return current;
      return save({ ...current, status: "ACTIVE", paidAt, redeemableUntil });
    },

    async markRedeemed({ voucherId, redeemedAt }) {
      const current = get(voucherId);
      if (current.status !== "ACTIVE") return current;
      return save({ ...current, status: "REDEEMED", redeemedAt });
    },

    async markCancelled({ voucherId, cancelledAt, refunded }) {
      const current = get(voucherId);
      if (current.status === "REDEEMED") return current;
      return save({
        ...current,
        status: refunded ? "REFUNDED" : "CANCELLED",
        cancelledAt,
      });
    },

    async markCarriedOver({ voucherId, carriedOverAt, carriedOverToEditionId }) {
      const current = get(voucherId);
      if (current.status !== "ACTIVE") return current;
      return save({
        ...current,
        status: "CARRIED_OVER",
        carriedOverAt,
        carriedOverToEditionId,
      });
    },

    async reissueCode({ voucherId, newCode }) {
      const current = get(voucherId);
      return save({ ...current, code: newCode, reissueCount: current.reissueCount + 1 });
    },
  };
}
