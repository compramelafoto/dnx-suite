import { createCheckoutEligibilityUseCase } from "@/lib/public-registration/application/checkout-eligibility";
import { verifyRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";
import { CheckoutError } from "../domain/errors";
import { mapDnxStatusToClickatonEffect, maskExternalReference } from "../domain/mapping";
import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { CheckoutReturnDto, RegistrationPaymentStatusDto } from "../domain/types";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";

export function createGetRegistrationPaymentStatusUseCase(deps: {
  publicRepo: PublicRegistrationRepository;
  payments: DnxPaymentsClient;
  registrationPort: CheckoutRegistrationPort;
}) {
  const eligibility = createCheckoutEligibilityUseCase({ repo: deps.publicRepo });

  async function buildDto(input: {
    registrationId: string;
    editionSlug: string;
    accessToken: string;
    refresh: boolean;
  }): Promise<RegistrationPaymentStatusDto> {
    const token = verifyRegistrationAccessToken({
      registrationId: input.registrationId,
      editionSlug: input.editionSlug,
      token: input.accessToken,
    });
    if (!token.ok) {
      throw new CheckoutError(
        token.code === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
        token.code === "TOKEN_EXPIRED"
          ? "El enlace expiró."
          : "Enlace de acceso inválido.",
      );
    }

    let registration = await deps.registrationPort.getRegistration(input.registrationId);
    if (!registration) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");

    let order = registration.paymentOrderId
      ? await deps.payments.getOrder(registration.paymentOrderId)
      : null;
    if (input.refresh && registration.paymentOrderId) {
      order = await deps.payments.refreshOrder(registration.paymentOrderId);
      // S2S refresh actualiza DNX; sincronizar efectos Clickatón (no confiar en redirect).
      if (order) {
        const syncEffect = mapDnxStatusToClickatonEffect(order.status);
        if (
          syncEffect.holds === "confirm" &&
          registration.status !== "CONFIRMED" &&
          order.amountMinor === registration.money.totalAmount &&
          order.currency === "ARS"
        ) {
          const holds = await deps.registrationPort.getHoldSnapshot(registration.id);
          const holdExpired =
            registration.holdExpiresAt != null &&
            registration.holdExpiresAt.getTime() < Date.now();
          if (!holdExpired && holds.capacityHoldActive) {
            const prefix = await deps.registrationPort.getEditionPrefix(registration.editionId);
            registration = await deps.registrationPort.confirmPaid({
              registrationId: registration.id,
              paymentOrderId: order.id,
              source: "dnx_payments_s2s_refresh",
              requestId: `s2s_refresh_${order.id}_${Date.now()}`,
              editionPrefix: prefix,
            });
          }
        } else if (
          (order.status === "REJECTED" || order.status === "CANCELLED") &&
          registration.paymentStatus !== "FAILED" &&
          registration.paymentStatus !== "CANCELLED" &&
          registration.status !== "CONFIRMED"
        ) {
          registration = await deps.registrationPort.markPaymentStatus({
            registrationId: registration.id,
            paymentStatus: order.status === "CANCELLED" ? "CANCELLED" : "FAILED",
            registrationStatus: "PENDING_PAYMENT",
            source: "dnx_payments_s2s_refresh",
            reason: `s2s_${order.status.toLowerCase()}`,
            requestId: `s2s_refresh_${order.id}_${Date.now()}`,
          });
        }
      }
    }

    // Fallback desde soft refs (orden DNX no en memoria del proceso).
    const normalizedFromRegistration =
      registration.paymentStatus === "APPROVED"
        ? ("APPROVED" as const)
        : registration.paymentStatus === "PROCESSING"
          ? ("PROCESSING" as const)
          : registration.paymentStatus === "FAILED"
            ? ("REJECTED" as const)
            : registration.paymentStatus === "EXPIRED"
              ? ("EXPIRED" as const)
              : registration.paymentStatus === "CANCELLED"
                ? ("CANCELLED" as const)
                : registration.paymentStatus === "PENDING"
                  ? ("PENDING" as const)
                  : null;

    const normalized = order?.status ?? normalizedFromRegistration;
    const effect = normalized ? mapDnxStatusToClickatonEffect(normalized) : null;
    const confirmed =
      registration.status === "CONFIRMED" && registration.paymentStatus === "APPROVED";
    const pending =
      !confirmed &&
      (normalized === "CREATED" ||
        normalized === "PENDING" ||
        normalized === "PROCESSING" ||
        registration.paymentStatus === "PENDING" ||
        registration.paymentStatus === "PROCESSING");

    let canRetry = false;
    try {
      const elig = await eligibility.getRegistrationCheckoutEligibility({
        registrationId: input.registrationId,
        editionSlug: input.editionSlug,
        accessToken: input.accessToken,
      });
      canRetry =
        elig.eligible &&
        (registration.paymentStatus === "FAILED" ||
          registration.paymentStatus === "PENDING" ||
          !registration.paymentOrderId);
    } catch {
      canRetry = false;
    }

    return {
      registrationId: registration.id,
      registrationStatus: registration.status,
      paymentStatus: registration.paymentStatus,
      normalizedOrderStatus: normalized,
      paymentOrderId: registration.paymentOrderId ?? null,
      provider: registration.paymentProvider ?? order?.provider ?? null,
      externalReferenceMasked: maskExternalReference(
        registration.paymentExternalReference ?? order?.externalReference,
      ),
      amountMinor: registration.money.totalAmount,
      currency: registration.money.currency,
      confirmed,
      pending,
      canRetryCheckout: canRetry,
      message: confirmed
        ? "Pago confirmado. Tu inscripción está confirmada."
        : effect?.publicMessage ??
          "Estado de pago en consulta. Puede demorar unos minutos en actualizarse.",
      lastSyncedAt: order?.updatedAt ?? null,
    };
  }

  return {
    async getStatus(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
    }): Promise<RegistrationPaymentStatusDto> {
      return buildDto({ ...input, refresh: false });
    },

    async refreshStatus(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
    }): Promise<RegistrationPaymentStatusDto> {
      return buildDto({ ...input, refresh: true });
    },

    async getReturnResult(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
    }): Promise<CheckoutReturnDto> {
      const status = await buildDto({ ...input, refresh: true });
      const registration = await deps.registrationPort.getRegistration(input.registrationId);
      return {
        ...status,
        editionSlug: input.editionSlug,
        publicCode: registration?.visibleCode ?? null,
        holdExpiresAt: registration?.holdExpiresAt ?? null,
        // Redirect nunca confirma solo: displayAsApproved solo si backend ya confirmó.
        displayAsApproved: status.confirmed,
      };
    },
  };
}

export type GetRegistrationPaymentStatusUseCase = ReturnType<
  typeof createGetRegistrationPaymentStatusUseCase
>;
