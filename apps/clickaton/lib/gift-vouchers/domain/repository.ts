import type { CreateGiftVoucherCommand, GiftVoucherRecord } from "./types";

/**
 * Persistencia del voucher. Todas las transiciones son idempotentes: el aviso
 * de pago de Mercado Pago puede llegar dos veces y la pantalla de canje puede
 * enviarse dos veces.
 */
export interface GiftVoucherRepository {
  create(cmd: CreateGiftVoucherCommand): Promise<GiftVoucherRecord>;
  findByCode(code: string): Promise<GiftVoucherRecord | null>;
  findByRegistrationId(registrationId: string): Promise<GiftVoucherRecord | null>;
  /** Pago acreditado: PENDING_PAYMENT → ACTIVE. */
  markPaid(input: {
    voucherId: string;
    paidAt: Date;
    redeemableUntil: Date | null;
  }): Promise<GiftVoucherRecord>;
  /** Canje: ACTIVE → REDEEMED. */
  markRedeemed(input: {
    voucherId: string;
    redeemedAt: Date;
  }): Promise<GiftVoucherRecord>;
  /** Anulación. Un voucher ya canjeado no se anula: la inscripción es de otra persona. */
  markCancelled(input: {
    voucherId: string;
    cancelledAt: Date;
    refunded: boolean;
  }): Promise<GiftVoucherRecord>;
  /** Cerró la inscripción sin canje: ACTIVE → CARRIED_OVER. */
  markCarriedOver(input: {
    voucherId: string;
    carriedOverAt: Date;
    carriedOverToEditionId: string | null;
  }): Promise<GiftVoucherRecord>;
  /** Invalida el código anterior y guarda el nuevo. */
  reissueCode(input: { voucherId: string; newCode: string }): Promise<GiftVoucherRecord>;
}
