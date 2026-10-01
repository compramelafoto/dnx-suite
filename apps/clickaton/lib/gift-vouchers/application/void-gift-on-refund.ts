import type { GiftVoucherRepository } from "../domain/repository";

/**
 * Devolvieron el dinero de un regalo: el voucher deja de servir y el cupo
 * vuelve a la venta.
 *
 * Sin esto, el pago se devuelve y el código sigue funcionando: quien lo
 * recibe activa una inscripción que ya nadie pagó.
 *
 * Un regalo YA ACTIVADO no se toca. Esa inscripción pasó a ser de otra
 * persona, y devolver la plata de algo ya usado es un problema comercial, no
 * algo que se arregle borrándole el lugar a quien lo activó de buena fe.
 */
export function voidGiftVoucherOnRefund(deps: {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  registrations: {
    releaseGiftRegistration(registrationId: string): Promise<void>;
  };
}) {
  return {
    async execute(input: {
      registrationId: string;
    }): Promise<{ voided: boolean; code: string | null }> {
      const voucher = await deps.vouchers.findByRegistrationId(input.registrationId);
      if (!voucher) return { voided: false, code: null };

      // Idempotente: un segundo aviso de devolución no vuelve a liberar.
      if (voucher.status !== "PENDING_PAYMENT" && voucher.status !== "ACTIVE") {
        return { voided: false, code: voucher.code };
      }

      await deps.registrations.releaseGiftRegistration(voucher.registrationId);
      await deps.vouchers.markCancelled({
        voucherId: voucher.id,
        cancelledAt: deps.clock.now(),
        refunded: true,
      });

      return { voided: true, code: voucher.code };
    },
  };
}
