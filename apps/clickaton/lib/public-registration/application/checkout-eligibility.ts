import { isStalePendingHold } from "../domain/expiration-rules";
import type { PublicRegistrationRepository } from "../domain/repository";
import type { CheckoutEligibilityDto } from "../domain/types";
import { PublicRegistrationError } from "../domain/errors";
import {
  signRegistrationAccessToken,
  verifyRegistrationAccessToken,
} from "../domain/access-token";

export function createCheckoutEligibilityUseCase(deps: {
  repo: PublicRegistrationRepository;
}) {
  const { repo } = deps;

  return {
    async getRegistrationCheckoutEligibility(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
      now?: Date;
    }): Promise<CheckoutEligibilityDto> {
      const now = input.now ?? new Date();
      const token = verifyRegistrationAccessToken({
        registrationId: input.registrationId,
        editionSlug: input.editionSlug,
        token: input.accessToken,
        now,
      });
      if (!token.ok) {
        throw new PublicRegistrationError(
          token.code,
          token.code === "TOKEN_EXPIRED"
            ? "El enlace del resumen expiró."
            : "Enlace de acceso inválido.",
        );
      }

      const registration = await repo.getRegistration(input.registrationId);
      if (!registration) {
        throw new PublicRegistrationError("NOT_FOUND", "Inscripción no encontrada.");
      }
      const edition = await repo.getEditionBySlug(input.editionSlug);
      if (!edition || edition.id !== registration.editionId) {
        throw new PublicRegistrationError("NOT_FOUND", "Inscripción no encontrada.");
      }

      const holds = await repo.getHoldSnapshot(registration.id);
      const stale = isStalePendingHold({
        status: registration.status,
        holdExpiresAt: registration.holdExpiresAt,
        now,
      });
      const expiredMaterialized =
        registration.status === "CANCELLED" && registration.paymentStatus === "EXPIRED";

      const base: CheckoutEligibilityDto = {
        eligible: false,
        reason: null,
        registrationStatus: registration.status,
        paymentStatus: registration.paymentStatus,
        expiresAt: registration.holdExpiresAt ?? null,
        amountMinor: registration.money.totalAmount,
        currency: registration.money.currency,
        editionId: registration.editionId,
        ticketTypeId: registration.ticketTypeId,
        publicCode: registration.visibleCode ?? null,
      };

      if (registration.paymentStatus === "APPROVED") {
        return { ...base, reason: "payment_already_approved" };
      }
      if (registration.status === "CONFIRMED") {
        return { ...base, reason: "already_confirmed" };
      }
      if (registration.status === "CANCELLED" || expiredMaterialized) {
        return {
          ...base,
          reason: expiredMaterialized || stale ? "registration_expired" : "cancelled",
        };
      }
      if (registration.status === "DISQUALIFIED" || registration.status === "REFUNDED") {
        return { ...base, reason: "not_payable_status" };
      }
      if (stale) {
        return { ...base, reason: "registration_expired" };
      }
      if (registration.status !== "PENDING_PAYMENT" && registration.status !== "DRAFT") {
        return { ...base, reason: "not_payable_status" };
      }
      if (!holds.capacityHoldActive) {
        return { ...base, reason: "holds_missing" };
      }
      if (registration.money.totalAmount < 0) {
        return { ...base, reason: "invalid_amount" };
      }

      return { ...base, eligible: true, reason: null };
    },

    /** Firma un token de resumen (helper tests). */
    signSummaryToken(registrationId: string, editionSlug: string, expiresAtMs: number) {
      return signRegistrationAccessToken({ registrationId, editionSlug, expiresAtMs });
    },
  };
}

export type CheckoutEligibilityUseCase = ReturnType<typeof createCheckoutEligibilityUseCase>;
