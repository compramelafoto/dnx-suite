"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { manageGiftVoucherUseCase } from "./application/manage-gift-voucher";
import type { GiftVoucherStatus } from "./domain/status";
import { createPrismaGiftVoucherRepository } from "./infrastructure/prisma-gift-voucher-repository";
import { resendGiftInvitation } from "./notifications/notify-gift-lifecycle";

export type AdminGiftVoucherRow = {
  code: string;
  status: GiftVoucherStatus;
  buyerName: string;
  buyerEmail: string;
  recipientName: string | null;
  recipientEmail: string | null;
  amountMinor: number;
  currency: string;
  paidAt: Date | null;
  redeemedAt: Date | null;
  redeemableUntil: Date | null;
  reissueCount: number;
  recipientEmailCount: number;
  /** Quién activó el regalo, cuando ya se activó. */
  participantName: string | null;
  visibleCode: string | null;
  createdAt: Date;
};

export type AdminGiftVoucherSummary = {
  vendidos: number;
  esperandoPago: number;
  sinActivar: number;
  activados: number;
  anulados: number;
  /** Suma cobrada de los regalos pagados, en minor units. */
  recaudadoMinor: number;
};

function manage() {
  const publicRepo = createPrismaPublicRegistrationRepository();
  return manageGiftVoucherUseCase({
    vouchers: createPrismaGiftVoucherRepository(),
    clock: { now: () => new Date() },
    registrations: {
      async releaseGiftRegistration(registrationId) {
        await publicRepo.releaseGiftRegistration({
          registrationId,
          now: new Date(),
          reason: "admin_gift_cancel",
        });
      },
    },
  });
}

export async function listEditionGiftVouchersAction(editionId: string): Promise<{
  rows: AdminGiftVoucherRow[];
  summary: AdminGiftVoucherSummary;
}> {
  await requireClickatonAdmin();

  const rows = await prisma.clickatonGiftVoucher.findMany({
    where: { editionId },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      status: true,
      buyerFirstName: true,
      buyerLastName: true,
      buyerEmail: true,
      recipientName: true,
      recipientEmail: true,
      paidAt: true,
      redeemedAt: true,
      redeemableUntil: true,
      reissueCount: true,
      recipientEmailCount: true,
      createdAt: true,
      registration: {
        select: {
          totalAmount: true,
          currency: true,
          firstName: true,
          lastName: true,
          visibleCode: true,
          status: true,
        },
      },
    },
  });

  const summary: AdminGiftVoucherSummary = {
    vendidos: 0,
    esperandoPago: 0,
    sinActivar: 0,
    activados: 0,
    anulados: 0,
    recaudadoMinor: 0,
  };

  const mapped = rows.map((row): AdminGiftVoucherRow => {
    if (row.status === "PENDING_PAYMENT") summary.esperandoPago += 1;
    if (row.status === "ACTIVE") summary.sinActivar += 1;
    if (row.status === "REDEEMED") summary.activados += 1;
    if (row.status === "CANCELLED" || row.status === "REFUNDED") summary.anulados += 1;
    if (row.paidAt && row.status !== "REFUNDED") {
      summary.vendidos += 1;
      summary.recaudadoMinor += row.registration.totalAmount;
    }

    return {
      code: row.code,
      status: row.status,
      buyerName: `${row.buyerFirstName} ${row.buyerLastName}`.trim(),
      buyerEmail: row.buyerEmail,
      recipientName: row.recipientName,
      recipientEmail: row.recipientEmail,
      amountMinor: row.registration.totalAmount,
      currency: row.registration.currency,
      paidAt: row.paidAt,
      redeemedAt: row.redeemedAt,
      redeemableUntil: row.redeemableUntil,
      reissueCount: row.reissueCount,
      recipientEmailCount: row.recipientEmailCount,
      // El nombre de la inscripción es el del comprador hasta que se activa.
      participantName:
        row.status === "REDEEMED"
          ? `${row.registration.firstName} ${row.registration.lastName}`.trim()
          : null,
      visibleCode: row.registration.visibleCode,
      createdAt: row.createdAt,
    };
  });

  return { rows: mapped, summary };
}

export async function cancelGiftVoucherAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const code = String(formData.get("code") ?? "");
  const editionId = String(formData.get("editionId") ?? "");
  const refunded = formData.get("refunded") === "true";

  await manage().cancel({ code, refunded });
  revalidatePath(`/admin/ediciones/${editionId}/regalos`);
}

export async function reissueGiftVoucherAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const code = String(formData.get("code") ?? "");
  const editionId = String(formData.get("editionId") ?? "");

  await manage().reissue({ code });
  revalidatePath(`/admin/ediciones/${editionId}/regalos`);
}

export async function resendGiftVoucherAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const code = String(formData.get("code") ?? "");
  const editionId = String(formData.get("editionId") ?? "");
  const newRecipientEmail = String(formData.get("recipientEmail") ?? "").trim() || null;

  const voucher = await prisma.clickatonGiftVoucher.findUnique({
    where: { code },
    select: { registrationId: true },
  });
  if (voucher) {
    await resendGiftInvitation({
      registrationId: voucher.registrationId,
      newRecipientEmail,
    });
  }
  revalidatePath(`/admin/ediciones/${editionId}/regalos`);
}
