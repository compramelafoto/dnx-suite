import type { GiftVoucherStatus } from "./status";

/** Fila del voucher, sin acoplar la aplicación al cliente de Prisma. */
export type GiftVoucherRecord = {
  id: string;
  code: string;
  status: GiftVoucherStatus;
  editionId: string;
  registrationId: string;
  buyerUserId: number | null;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  giftMessage: string | null;
  paidAt: Date | null;
  redeemableUntil: Date | null;
  redeemedAt: Date | null;
  cancelledAt: Date | null;
  carriedOverToEditionId: string | null;
  carriedOverAt: Date | null;
  reissueCount: number;
  recipientEmailSentAt: Date | null;
  recipientEmailCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateGiftVoucherCommand = {
  code: string;
  editionId: string;
  registrationId: string;
  buyerUserId: number | null;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  giftMessage: string | null;
};
