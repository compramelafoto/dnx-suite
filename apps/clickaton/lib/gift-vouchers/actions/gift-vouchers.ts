"use server";

import { prisma } from "@repo/db";
import { normalizeGiftVoucherCode } from "../domain/code";
import { evaluateGiftRedeemEligibility, type GiftVoucherStatus } from "../domain/status";
import {
  formBool,
  formString,
  giftFailure,
  giftSuccess,
  type GiftActionState,
} from "./action-result";
import { getGiftVoucherRuntime } from "./runtime";

export type GiftVoucherPublicDto = {
  code: string;
  status: GiftVoucherStatus;
  /** Sólo el nombre de pila: no se expone el email de quien regaló. */
  buyerFirstName: string;
  recipientName: string | null;
  giftMessage: string | null;
  editionSlug: string;
  editionName: string;
  editionStartAt: string | null;
  ticketTypeId: string;
  ticketName: string;
  venueName: string | null;
  canRedeem: boolean;
  blockMessage: string | null;
};

export async function createGiftRegistrationAction(
  _prev: GiftActionState | undefined,
  formData: FormData,
): Promise<GiftActionState<{ registrationId: string; voucherCode: string }>> {
  const values = {
    firstName: formString(formData, "firstName"),
    lastName: formString(formData, "lastName"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    recipientName: formString(formData, "recipientName"),
    recipientEmail: formString(formData, "recipientEmail"),
    giftMessage: formString(formData, "giftMessage"),
  };

  try {
    const result = await getGiftVoucherRuntime().createGift.execute({
      editionSlug: formString(formData, "editionSlug"),
      ticketTypeId: formString(formData, "ticketTypeId"),
      buyer: {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
      },
      recipientName: values.recipientName,
      recipientEmail: values.recipientEmail,
      giftMessage: values.giftMessage,
      acceptTerms: formBool(formData, "acceptTerms"),
      promoCode: formString(formData, "promoCode") || null,
      idempotencyKey: formString(formData, "idempotencyKey"),
    });
    return giftSuccess({
      registrationId: result.registrationId,
      voucherCode: result.voucherCode,
    });
  } catch (error) {
    return giftFailure(error, values);
  }
}

/**
 * Datos públicos del regalo para la pantalla de activación.
 * No devuelve emails ni el id de la inscripción: sólo lo que hace falta
 * mostrar a quien abre el link.
 */
export async function getGiftVoucherPublicAction(
  rawCode: string,
): Promise<GiftActionState<GiftVoucherPublicDto>> {
  try {
    const code = normalizeGiftVoucherCode(rawCode);
    if (!code) {
      return { ok: false, code: "NOT_FOUND", message: "No encontramos ese regalo." };
    }

    const voucher = await prisma.clickatonGiftVoucher.findUnique({
      where: { code },
      select: {
        code: true,
        status: true,
        buyerFirstName: true,
        recipientName: true,
        giftMessage: true,
        redeemableUntil: true,
        edition: {
          select: {
            slug: true,
            name: true,
            startAt: true,
            giftVouchersEnabled: true,
            registrationCloseAt: true,
          },
        },
        registration: {
          select: {
            ticketTypeId: true,
            ticketType: { select: { name: true } },
            venue: { select: { name: true } },
          },
        },
      },
    });
    if (!voucher) {
      return { ok: false, code: "NOT_FOUND", message: "No encontramos ese regalo." };
    }

    const eligibility = evaluateGiftRedeemEligibility({
      status: voucher.status,
      redeemableUntil: voucher.redeemableUntil,
      editionRegistrationCloseAt: voucher.edition.registrationCloseAt,
      giftVouchersEnabled: voucher.edition.giftVouchersEnabled,
      now: new Date(),
    });

    return giftSuccess<GiftVoucherPublicDto>({
      code: voucher.code,
      status: voucher.status,
      buyerFirstName: voucher.buyerFirstName,
      recipientName: voucher.recipientName,
      giftMessage: voucher.giftMessage,
      editionSlug: voucher.edition.slug,
      editionName: voucher.edition.name,
      editionStartAt: voucher.edition.startAt?.toISOString() ?? null,
      ticketTypeId: voucher.registration.ticketTypeId,
      ticketName: voucher.registration.ticketType.name,
      venueName: voucher.registration.venue?.name ?? null,
      canRedeem: eligibility.ok,
      blockMessage: eligibility.ok ? null : eligibility.message,
    });
  } catch (error) {
    return giftFailure(error);
  }
}

export async function redeemGiftVoucherAction(
  _prev: GiftActionState | undefined,
  formData: FormData,
): Promise<GiftActionState<{ registrationId: string; visibleCode: string | null }>> {
  const variantRaw = formString(formData, "variantChoices");
  let variantChoices: Array<{ productId: string; productVariantId: string }> = [];
  try {
    if (variantRaw) variantChoices = JSON.parse(variantRaw) as typeof variantChoices;
  } catch {
    variantChoices = [];
  }

  try {
    const result = await getGiftVoucherRuntime().redeemGift.execute({
      code: formString(formData, "code"),
      venueId: formString(formData, "venueId") || null,
      variantChoices,
      participant: {
        firstName: formString(formData, "firstName"),
        lastName: formString(formData, "lastName"),
        email: formString(formData, "email"),
        phone: formString(formData, "phone"),
        documentNumber: formString(formData, "documentNumber"),
        city: formString(formData, "city"),
        province: formString(formData, "province"),
        country: formString(formData, "country") || "AR",
        birthDate: formString(formData, "birthDate"),
        emergencyContactName: formString(formData, "emergencyContactName"),
        emergencyContactPhone: formString(formData, "emergencyContactPhone"),
      },
      profilePhotoAssetId: formString(formData, "profilePhotoAssetId"),
      instagramHandle: formString(formData, "instagramHandle"),
      acceptTerms: formBool(formData, "acceptTerms"),
      idempotencyKey: formString(formData, "idempotencyKey"),
    });

    // El aviso nunca frena el canje: la inscripción ya quedó confirmada.
    const { notifyGiftRedeemed } = await import(
      "../notifications/notify-gift-lifecycle"
    );
    await notifyGiftRedeemed(result.registrationId);

    return giftSuccess(result);
  } catch (error) {
    return giftFailure(error);
  }
}
