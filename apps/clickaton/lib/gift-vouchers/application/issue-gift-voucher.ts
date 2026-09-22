import type { GiftVoucherRepository } from "../domain/repository";

/**
 * Se acreditó el pago del regalo: el voucher queda listo para que quien lo
 * recibe lo active, con plazo hasta el cierre de inscripciones de la edición.
 *
 * Idempotente: el aviso de Mercado Pago puede llegar más de una vez, y la
 * fecha de pago que vale es la primera.
 */
export function issueGiftVoucherOnPayment(deps: { vouchers: GiftVoucherRepository }) {
  return {
    async execute(input: {
      registrationId: string;
      editionRegistrationCloseAt: Date | null;
      paidAt: Date;
    }): Promise<{ issued: boolean; code: string | null }> {
      const voucher = await deps.vouchers.findByRegistrationId(input.registrationId);
      if (!voucher) return { issued: false, code: null };
      if (voucher.status !== "PENDING_PAYMENT") {
        return { issued: false, code: voucher.code };
      }

      const updated = await deps.vouchers.markPaid({
        voucherId: voucher.id,
        paidAt: input.paidAt,
        redeemableUntil: input.editionRegistrationCloseAt,
      });
      return { issued: updated.status === "ACTIVE", code: updated.code };
    },
  };
}
