import { createCheckoutEligibilityUseCase } from "@/lib/public-registration/application/checkout-eligibility";
import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";
import { PublicRegistrationError } from "@/lib/public-registration/domain/errors";
import { buildCheckoutIdempotencyKey } from "../domain/idempotency";
import { CheckoutError } from "../domain/errors";
import type { CheckoutLogSink } from "../domain/observability";
import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { CheckoutRedirectDto, CreatePaymentOrderInput } from "../domain/types";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";

export type CreateRegistrationCheckoutInput = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  publicBaseUrl: string;
  now?: Date;
};

function mapEligibilityReason(reason: string | null): CheckoutError {
  switch (reason) {
    case "payment_already_approved":
      return new CheckoutError("PAYMENT_ALREADY_APPROVED", "El pago ya fue aprobado.");
    case "already_confirmed":
      return new CheckoutError("PAYMENT_ALREADY_APPROVED", "La inscripción ya está confirmada.");
    case "registration_expired":
      return new CheckoutError("REGISTRATION_EXPIRED", "La reserva venció.");
    case "cancelled":
      return new CheckoutError("REGISTRATION_NOT_PAYABLE", "La inscripción está cancelada.");
    case "not_payable_status":
      return new CheckoutError("REGISTRATION_NOT_PAYABLE", "La inscripción no admite pago.");
    case "holds_missing":
      return new CheckoutError("HOLD_CONFLICT", "No hay holds activos para esta reserva.");
    case "invalid_amount":
      return new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Importe inválido.");
    default:
      return new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Checkout no disponible.");
  }
}

export function createRegistrationCheckoutUseCase(deps: {
  publicRepo: PublicRegistrationRepository;
  payments: DnxPaymentsClient;
  registrationPort: CheckoutRegistrationPort;
  log?: CheckoutLogSink;
}) {
  const eligibility = createCheckoutEligibilityUseCase({ repo: deps.publicRepo });
  const log = deps.log;

  return {
    async execute(input: CreateRegistrationCheckoutInput): Promise<CheckoutRedirectDto> {
      log?.({
        event: "checkout_requested",
        registrationId: input.registrationId,
      });

      let eligible;
      try {
        eligible = await eligibility.getRegistrationCheckoutEligibility({
          registrationId: input.registrationId,
          editionSlug: input.editionSlug,
          accessToken: input.accessToken,
          now: input.now,
        });
      } catch (error) {
        if (error instanceof PublicRegistrationError) {
          throw new CheckoutError(
            error.code as CheckoutError["code"],
            error.message,
          );
        }
        throw error;
      }

      if (!eligible.eligible) {
        throw mapEligibilityReason(eligible.reason);
      }

      if (eligible.currency !== "ARS") {
        log?.({ event: "invalid_currency", registrationId: input.registrationId });
        throw new CheckoutError("PAYMENT_CURRENCY_MISMATCH", "Moneda no soportada.");
      }
      if (!Number.isInteger(eligible.amountMinor) || eligible.amountMinor <= 0) {
        log?.({ event: "invalid_amount", registrationId: input.registrationId });
        throw new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Importe inválido para cobro.");
      }

      const registration = await deps.publicRepo.getRegistration(input.registrationId);
      if (!registration) {
        throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
      }

      const reservationKey = registration.paymentIdempotencyKey;
      if (!reservationKey || reservationKey.length < 8) {
        throw new CheckoutError(
          "IDEMPOTENCY_CONFLICT",
          "Falta clave de idempotencia de la reserva.",
        );
      }

      // Si ya hay orden pendiente reutilizable, el cliente la devolverá.
      const attempt =
        registration.paymentOrderId &&
        (registration.paymentStatus === "FAILED" ||
          registration.paymentStatus === "EXPIRED" ||
          registration.paymentStatus === "CANCELLED")
          ? 2
          : 1;

      const idempotencyKey = buildCheckoutIdempotencyKey({
        registrationId: registration.id,
        reservationIdempotencyKey: reservationKey,
        attempt,
      });

      const base = input.publicBaseUrl.replace(/\/$/, "");
      const tokenQ = encodeURIComponent(input.accessToken);
      const orderInput: CreatePaymentOrderInput = {
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: registration.id,
        idempotencyKey,
        amountMinor: eligible.amountMinor,
        currency: "ARS",
        description: `Inscripción Clickatón · ${eligible.publicCode ?? registration.id.slice(0, 8)}`,
        payer: {
          email: registration.participant.email,
          firstName: registration.participant.firstName,
          lastName: registration.participant.lastName,
        },
        successUrl: `${base}/maratones/${input.editionSlug}/inscripcion/pago/exito?registrationId=${registration.id}&t=${tokenQ}`,
        pendingUrl: `${base}/maratones/${input.editionSlug}/inscripcion/pago/pendiente?registrationId=${registration.id}&t=${tokenQ}`,
        failureUrl: `${base}/maratones/${input.editionSlug}/inscripcion/pago/error?registrationId=${registration.id}&t=${tokenQ}`,
        webhookContext: {
          editionId: registration.editionId,
          ticketTypeId: registration.ticketTypeId,
          sourceApp: "CLICKATON",
        },
      };

      const result = await deps.payments.createOrder(orderInput);
      if (result.outcome === "conflict") {
        log?.({
          event: "conflict",
          registrationId: registration.id,
          meta: { code: result.code },
        });
        throw new CheckoutError("IDEMPOTENCY_CONFLICT", result.message);
      }

      const order = result.order;
      if (!order.checkoutUrl) {
        throw new CheckoutError("PROVIDER_UNAVAILABLE", "No hay URL de checkout.");
      }

      const paymentStatus =
        order.status === "PROCESSING"
          ? "PROCESSING"
          : order.status === "APPROVED"
            ? "APPROVED"
            : "PENDING";

      await deps.registrationPort.attachPaymentRefs({
        registrationId: registration.id,
        paymentOrderId: order.id,
        paymentProvider: order.provider,
        paymentExternalReference: order.externalReference,
        paymentIdempotencyKey: reservationKey,
        paymentStatus,
      });

      log?.({
        event: result.outcome === "reused" ? "order_reused" : "order_created",
        registrationId: registration.id,
        orderId: order.id,
        meta: { attempt: order.attempt, status: order.status },
      });
      log?.({
        event: "redirect_issued",
        registrationId: registration.id,
        orderId: order.id,
      });

      return {
        registrationId: registration.id,
        paymentOrderId: order.id,
        checkoutUrl: order.checkoutUrl,
        amountMinor: order.amountMinor,
        currency: "ARS",
        provider: order.provider,
        status: order.status,
        reused: result.outcome === "reused",
        expiresAt: registration.holdExpiresAt ?? null,
      };
    },
  };
}

export type CreateRegistrationCheckoutUseCase = ReturnType<
  typeof createRegistrationCheckoutUseCase
>;
