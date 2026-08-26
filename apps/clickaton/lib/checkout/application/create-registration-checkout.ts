import { createCheckoutEligibilityUseCase } from "@/lib/public-registration/application/checkout-eligibility";
import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";
import { PublicRegistrationError } from "@/lib/public-registration/domain/errors";
import { resolveClickatonPaymentsProviderMode } from "@repo/payments/next";
import { buildCheckoutIdempotencyKey } from "../domain/idempotency";
import { assertSafeCheckoutUrl } from "../domain/checkout-url";
import { CheckoutError } from "../domain/errors";
import type { CheckoutLogSink } from "../domain/observability";
import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { CheckoutRedirectDto, CreatePaymentOrderInput } from "../domain/types";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";

function buildCheckoutDescription(code: string): string {
  const base = `Inscripción Clickatón — ${code}`;
  // Checkout Pro TEST adapter requires "TEST" in the preference title (sandbox safety).
  const mode = resolveClickatonPaymentsProviderMode(
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual",
  );
  if (mode === "mercado_pago_test" || mode === "mercado_pago_orders_test") {
    return `${base} TEST`;
  }
  return base;
}

export type CreateRegistrationCheckoutInput = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  publicBaseUrl: string;
  now?: Date;
  /**
   * Card Payment Brick submission. Commercial amounts are NEVER taken from here —
   * only token / device / payment method / payer email hints.
   */
  cardPayment?: import("@repo/payments/frontend").CardPaymentSubmission;
  /**
   * Optional amount from browser — compared for mismatch detection only.
   * Charging always uses server eligibility amount.
   */
  clientDisplayedAmountMinor?: number;
};

function mapEligibilityReason(reason: string | null): CheckoutError {
  switch (reason) {
    case "payment_already_approved":
      return new CheckoutError("PAYMENT_ALREADY_APPROVED", "El pago ya fue aprobado.");
    case "already_confirmed":
      return new CheckoutError("PAYMENT_ALREADY_APPROVED", "La inscripci?n ya est? confirmada.");
    case "registration_expired":
      return new CheckoutError("REGISTRATION_EXPIRED", "La reserva venci?.");
    case "cancelled":
      return new CheckoutError("REGISTRATION_NOT_PAYABLE", "La inscripci?n est? cancelada.");
    case "not_payable_status":
      return new CheckoutError("REGISTRATION_NOT_PAYABLE", "La inscripci?n no admite pago.");
    case "holds_missing":
      return new CheckoutError("HOLD_CONFLICT", "No hay holds activos para esta reserva.");
    case "invalid_amount":
      return new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Importe inv?lido.");
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
        throw new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Importe inv?lido para cobro.");
      }

      const registration = await deps.publicRepo.getRegistration(input.registrationId);
      if (!registration) {
        throw new CheckoutError("NOT_FOUND", "Inscripci?n no encontrada.");
      }

      const reservationKey = registration.paymentIdempotencyKey;
      if (!reservationKey || reservationKey.length < 8) {
        throw new CheckoutError(
          "IDEMPOTENCY_CONFLICT",
          "Falta clave de idempotencia de la reserva.",
        );
      }

      // Si ya hay orden pendiente reutilizable, el cliente la devolver?.
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

      // Etapa 6: snapshot financiero inmutable = fuente de verdad del checkout.
      const providerMode = (
        process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual"
      ).toLowerCase();
      const requiresEditionFinance =
        providerMode.includes("mercado_pago") || providerMode.includes("mp_");

      let editionFinance: CreatePaymentOrderInput["editionFinance"];
      try {
        const { attachFinanceSnapshotToRegistration } = await import(
          "@/lib/admin/edition-finance/infrastructure/prisma-edition-finance"
        );
        const { toEditionCheckoutFinanceSnapshot } = await import(
          "@/lib/admin/edition-finance/domain/snapshot"
        );
        const { resolveCollectorAccessTokenFromPaymentAccount } = await import(
          "@/lib/admin/edition-finance/infrastructure/resolve-collector-token"
        );

        const gross =
          registration.money.subtotalAmount + registration.money.discountAmount;
        const snap = await attachFinanceSnapshotToRegistration({
          editionId: registration.editionId,
          registrationId: registration.id,
          currency: registration.money.currency,
          grossAmount: gross > 0 ? gross : registration.money.totalAmount,
          discountAmount: registration.money.discountAmount,
          providerFee: 0,
          platformFee: 0,
        });
        const checkoutSnap = toEditionCheckoutFinanceSnapshot(snap);
        const collectorAccountId = checkoutSnap.allocations[0]?.paymentAccountId;
        if (!collectorAccountId) {
          throw new CheckoutError(
            "CHECKOUT_NOT_AVAILABLE",
            "Snapshot financiero sin payment account del beneficiario.",
          );
        }

        let collectorAccessToken: string | undefined;
        if (requiresEditionFinance) {
          const tokenRes =
            await resolveCollectorAccessTokenFromPaymentAccount(collectorAccountId);
          if (!tokenRes.ok) {
            throw new CheckoutError(
              "CHECKOUT_NOT_AVAILABLE",
              `Cuenta Mercado Pago del beneficiario no usable (${tokenRes.code}).`,
            );
          }
          collectorAccessToken = tokenRes.accessToken;
        }

        editionFinance = {
          snapshot: checkoutSnap,
          ...(collectorAccessToken ? { collectorAccessToken } : {}),
        };
      } catch (error) {
        if (error instanceof CheckoutError) throw error;
        if (requiresEditionFinance) {
          const financeCode =
            error &&
            typeof error === "object" &&
            "code" in error &&
            typeof (error as { code: unknown }).code === "string"
              ? (error as { code: string }).code
              : null;
          log?.({
            event: "finance_snapshot_failed",
            registrationId: registration.id,
            meta: {
              financeCode: financeCode ?? "unknown",
              reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
            },
          });
          throw new CheckoutError(
            "CHECKOUT_NOT_AVAILABLE",
            financeCode === "NO_ACTIVE_DISTRIBUTION"
              ? "Todavía no se pueden cobrar inscripciones para esta edición. Probá más tarde o contactá a la organización."
              : error instanceof Error
                ? error.message.slice(0, 160)
                : "No se pudo resolver la distribución financiera.",
            financeCode ? { financeCode } : undefined,
          );
        }
        log?.({
          event: "finance_snapshot_skipped",
          registrationId: registration.id,
          meta: {
            reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          },
        });
      }

      const base = input.publicBaseUrl.replace(/\/$/, "");
      const tokenQ = encodeURIComponent(input.accessToken);
      if (
        input.clientDisplayedAmountMinor != null &&
        input.clientDisplayedAmountMinor !== eligible.amountMinor
      ) {
        log?.({
          event: "price_tamper_ignored",
          registrationId: registration.id,
          meta: {
            clientAmount: input.clientDisplayedAmountMinor,
            serverAmount: eligible.amountMinor,
          },
        });
      }

      const orderInput: CreatePaymentOrderInput = {
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: registration.id,
        idempotencyKey,
        amountMinor: eligible.amountMinor,
        currency: "ARS",
        description: buildCheckoutDescription(
          eligible.publicCode ?? registration.id.slice(0, 8),
        ),
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
        ...(editionFinance ? { editionFinance } : {}),
        ...(input.cardPayment
          ? {
              cardPayment: {
                ...input.cardPayment,
                // Always charge with server participant email (never trust browser).
                payer: {
                  ...input.cardPayment.payer,
                  email: registration.participant.email,
                },
              },
            }
          : {}),
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
      const urlCheck = assertSafeCheckoutUrl(order.checkoutUrl);
      if (!urlCheck.ok) {
        throw new CheckoutError(urlCheck.code, urlCheck.message);
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
        statusDetail: order.statusDetail ?? null,
      };
    },
  };
}

export type CreateRegistrationCheckoutUseCase = ReturnType<
  typeof createRegistrationCheckoutUseCase
>;
