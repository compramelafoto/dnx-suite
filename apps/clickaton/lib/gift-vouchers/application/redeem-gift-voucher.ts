import { normalizeGiftVoucherCode } from "../domain/code";
import type { GiftVoucherRepository } from "../domain/repository";
import { evaluateGiftRedeemEligibility } from "../domain/status";

/**
 * Quien recibe el regalo lo activa: completa la inscripción "a designar" con
 * sus propios datos, sin pagar. Es el mismo wizard de siempre menos el pago.
 */
export class GiftRedeemError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GiftRedeemError";
  }
}

export type RedeemParticipantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentNumber?: string;
  city?: string;
  province?: string;
  country?: string;
  birthDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type RedeemGiftVoucherInput = {
  code: string;
  venueId: string | null;
  variantChoices: Array<{ productId: string; productVariantId: string }>;
  participant: RedeemParticipantInput;
  profilePhotoAssetId: string;
  instagramHandle: string;
  acceptTerms: boolean;
  idempotencyKey: string;
};

export type GiftRedeemEditionView = {
  id: string;
  slug: string;
  giftVouchersEnabled: boolean;
  registrationCloseAt: Date | null;
  visibleCodePrefix: string | null;
};

export type RedeemGiftVoucherDeps = {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  registrations: {
    getEditionById(editionId: string): Promise<GiftRedeemEditionView | null>;
    completeGiftRegistration(cmd: Record<string, unknown>): Promise<{
      id: string;
      visibleCode: string | null;
    }>;
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_NOT_FOUND = "No encontramos ese código de regalo.";

export function redeemGiftVoucherUseCase(deps: RedeemGiftVoucherDeps) {
  return {
    async execute(input: RedeemGiftVoucherInput) {
      const code = normalizeGiftVoucherCode(input.code);
      if (!code) throw new GiftRedeemError("NOT_FOUND", CODE_NOT_FOUND);

      const voucher = await deps.vouchers.findByCode(code);
      if (!voucher) throw new GiftRedeemError("NOT_FOUND", CODE_NOT_FOUND);

      const edition = await deps.registrations.getEditionById(voucher.editionId);
      if (!edition) {
        throw new GiftRedeemError("NOT_FOUND", "No encontramos esa Clickatón.");
      }

      const now = deps.clock.now();
      const eligibility = evaluateGiftRedeemEligibility({
        status: voucher.status,
        redeemableUntil: voucher.redeemableUntil,
        editionRegistrationCloseAt: edition.registrationCloseAt,
        giftVouchersEnabled: edition.giftVouchersEnabled,
        now,
      });
      if (!eligibility.ok) {
        throw new GiftRedeemError(eligibility.code, eligibility.message);
      }

      if (!input.acceptTerms) {
        throw new GiftRedeemError(
          "CONSENT_REQUIRED",
          "Tenés que aceptar las bases y condiciones.",
        );
      }
      if (!input.profilePhotoAssetId?.trim()) {
        throw new GiftRedeemError("VALIDATION", "Subí una foto de perfil.");
      }
      if (!input.instagramHandle?.trim()) {
        throw new GiftRedeemError("VALIDATION", "Ingresá tu usuario de Instagram.");
      }
      if ((input.participant.firstName ?? "").trim().length < 2) {
        throw new GiftRedeemError("VALIDATION", "Completá tu nombre.");
      }
      if ((input.participant.lastName ?? "").trim().length < 2) {
        throw new GiftRedeemError("VALIDATION", "Completá tu apellido.");
      }
      const email = (input.participant.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        throw new GiftRedeemError("VALIDATION", "Ingresá un email válido.");
      }

      // El voucher se marca canjeado DESPUÉS de completar la inscripción: si
      // esto falla (sin stock del talle, cupo de sede), el regalo sigue vivo.
      const completed = await deps.registrations.completeGiftRegistration({
        registrationId: voucher.registrationId,
        editionId: voucher.editionId,
        editionPrefix: edition.visibleCodePrefix,
        venueId: input.venueId,
        variantChoices: input.variantChoices,
        participant: { ...input.participant, email },
        profilePhotoAssetId: input.profilePhotoAssetId.trim(),
        instagramHandle: input.instagramHandle.trim(),
        acceptedAt: now,
        idempotencyKey: input.idempotencyKey,
      });

      await deps.vouchers.markRedeemed({ voucherId: voucher.id, redeemedAt: now });

      return { registrationId: completed.id, visibleCode: completed.visibleCode };
    },
  };
}

export type RedeemGiftVoucherUseCase = ReturnType<typeof redeemGiftVoucherUseCase>;
