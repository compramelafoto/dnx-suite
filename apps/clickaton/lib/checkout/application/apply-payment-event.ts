import { CheckoutError } from "../domain/errors";
import { mapDnxStatusToClickatonEffect } from "../domain/mapping";
import type { CheckoutLogSink } from "../domain/observability";
import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { ApplyPaymentEventResult, NormalizedPaymentEvent } from "../domain/types";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";

/**
 * Proveedor → DNX Payments (evento normalizado) → efectos Clickatón.
 * Idempotente por eventId. No confía en redirect del browser.
 */
export function createApplyPaymentEventUseCase(deps: {
  payments: DnxPaymentsClient;
  registrationPort: CheckoutRegistrationPort;
  log?: CheckoutLogSink;
}) {
  const log = deps.log;

  return {
    async execute(event: NormalizedPaymentEvent): Promise<ApplyPaymentEventResult> {
      log?.({
        event: "webhook_received",
        registrationId: event.sourceId,
        orderId: event.orderId,
        meta: { eventId: event.eventId, status: event.status },
      });

      let order;
      try {
        order = await deps.payments.applyVerifiedEvent(event);
      } catch (error) {
        if (error instanceof CheckoutError) {
          log?.({
            event: "conflict",
            registrationId: event.sourceId,
            orderId: event.orderId,
            meta: { code: error.code },
          });
          const registration = await deps.registrationPort.getRegistration(event.sourceId);
          return {
            applied: false,
            duplicate: false,
            conflict: true,
            conflictCode: error.code,
            registrationId: event.sourceId,
            registrationStatus: registration?.status ?? "PENDING_PAYMENT",
            paymentStatus: registration?.paymentStatus ?? "PENDING",
            holdsAction: "none",
            orderStatus: event.status,
          };
        }
        throw error;
      }

      if (!order) {
        throw new CheckoutError("PAYMENT_ORDER_NOT_FOUND", "Orden no encontrada.");
      }

      const registration = await deps.registrationPort.getRegistration(event.sourceId);
      if (!registration) {
        throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
      }

      if (
        registration.paymentOrderId &&
        registration.paymentOrderId !== order.id
      ) {
        log?.({
          event: "conflict",
          registrationId: registration.id,
          orderId: order.id,
          meta: { code: "ORDER_ASSOCIATION" },
        });
        return {
          applied: false,
          duplicate: false,
          conflict: true,
          conflictCode: "PAYMENT_CONFLICT",
          registrationId: registration.id,
          registrationStatus: registration.status,
          paymentStatus: registration.paymentStatus,
          holdsAction: "none",
          orderStatus: order.status,
        };
      }

      // Evento duplicado: orden ya en estado terminal aprobado
      if (
        registration.status === "CONFIRMED" &&
        registration.paymentStatus === "APPROVED" &&
        order.status === "APPROVED"
      ) {
        return {
          applied: false,
          duplicate: true,
          conflict: false,
          registrationId: registration.id,
          registrationStatus: registration.status,
          paymentStatus: registration.paymentStatus,
          holdsAction: "none",
          orderStatus: order.status,
        };
      }

      log?.({
        event: "status_normalized",
        registrationId: registration.id,
        orderId: order.id,
        meta: { status: order.status },
      });

      const effect = mapDnxStatusToClickatonEffect(order.status);

      if (effect.holds === "confirm") {
        if (order.amountMinor !== registration.money.totalAmount) {
          log?.({ event: "invalid_amount", registrationId: registration.id, orderId: order.id });
          return {
            applied: false,
            duplicate: false,
            conflict: true,
            conflictCode: "PAYMENT_AMOUNT_MISMATCH",
            registrationId: registration.id,
            registrationStatus: registration.status,
            paymentStatus: registration.paymentStatus,
            holdsAction: "none",
            orderStatus: order.status,
          };
        }
        if (registration.money.currency !== "ARS" || order.currency !== "ARS") {
          log?.({ event: "invalid_currency", registrationId: registration.id, orderId: order.id });
          return {
            applied: false,
            duplicate: false,
            conflict: true,
            conflictCode: "PAYMENT_CURRENCY_MISMATCH",
            registrationId: registration.id,
            registrationStatus: registration.status,
            paymentStatus: registration.paymentStatus,
            holdsAction: "none",
            orderStatus: order.status,
          };
        }

        // Política: pago aprobado con hold vencido → conflicto (no confirmar silencioso).
        const holdExpired =
          registration.holdExpiresAt != null &&
          registration.holdExpiresAt.getTime() < Date.now() &&
          registration.status !== "CONFIRMED";
        const holds = await deps.registrationPort.getHoldSnapshot(registration.id);
        if (holdExpired || !holds.capacityHoldActive) {
          await deps.registrationPort.markPaymentStatus({
            registrationId: registration.id,
            paymentStatus: "MANUAL_REVIEW",
            source: "dnx_payments_webhook",
            reason: "approved_with_expired_or_missing_holds",
            requestId: event.eventId,
          });
          log?.({
            event: "conflict",
            registrationId: registration.id,
            orderId: order.id,
            meta: { code: "APPROVED_HOLD_CONFLICT" },
          });
          return {
            applied: false,
            duplicate: false,
            conflict: true,
            conflictCode: "HOLD_CONFLICT",
            registrationId: registration.id,
            registrationStatus: registration.status,
            paymentStatus: "MANUAL_REVIEW",
            holdsAction: "none",
            orderStatus: order.status,
          };
        }

        const prefix = await deps.registrationPort.getEditionPrefix(registration.editionId);
        if (!registration.paymentOrderId) {
          await deps.registrationPort.attachPaymentRefs({
            registrationId: registration.id,
            paymentOrderId: order.id,
            paymentProvider: order.provider,
            paymentExternalReference: order.externalReference,
            paymentIdempotencyKey: registration.paymentIdempotencyKey ?? order.idempotencyKey,
            paymentStatus: "PROCESSING",
          });
        }

        const confirmed = await deps.registrationPort.confirmPaid({
          registrationId: registration.id,
          paymentOrderId: order.id,
          source: "dnx_payments_webhook",
          requestId: event.eventId,
          editionPrefix: prefix,
        });

        log?.({
          event: "registration_confirmed",
          registrationId: confirmed.id,
          orderId: order.id,
        });

        return {
          applied: true,
          duplicate: false,
          conflict: false,
          registrationId: confirmed.id,
          registrationStatus: confirmed.status,
          paymentStatus: confirmed.paymentStatus,
          holdsAction: "confirm",
          orderStatus: order.status,
        };
      }

      if (effect.holds === "release_via_expire") {
        const payStatus = order.status === "CANCELLED" ? "CANCELLED" : "EXPIRED";
        const released = await deps.registrationPort.releaseForPaymentTerminal({
          registrationId: registration.id,
          paymentStatus: payStatus,
          source: "dnx_payments_webhook",
          requestId: event.eventId,
          now: new Date(),
        });
        log?.({
          event: "holds_released",
          registrationId: registration.id,
          orderId: order.id,
          meta: { via: "release_for_payment_terminal", paymentStatus: payStatus },
        });
        return {
          applied: true,
          duplicate: false,
          conflict: false,
          registrationId: released.id,
          registrationStatus: released.status,
          paymentStatus: released.paymentStatus,
          holdsAction: "release_via_expire",
          orderStatus: order.status,
        };
      }

      // PENDING / PROCESSING / REJECTED / CHARGEBACK / REFUNDED
      const nextStatus =
        effect.registrationStatus === "unchanged"
          ? undefined
          : effect.registrationStatus;
      const nextPay =
        effect.paymentStatus === "unchanged" ? registration.paymentStatus : effect.paymentStatus;

      const updated = await deps.registrationPort.markPaymentStatus({
        registrationId: registration.id,
        paymentStatus: nextPay,
        registrationStatus: nextStatus,
        source: "dnx_payments_webhook",
        reason: `order_${order.status.toLowerCase()}`,
        requestId: event.eventId,
      });

      return {
        applied: true,
        duplicate: false,
        conflict: false,
        registrationId: updated.id,
        registrationStatus: updated.status,
        paymentStatus: updated.paymentStatus,
        holdsAction: "keep",
        orderStatus: order.status,
      };
    },
  };
}

export type ApplyPaymentEventUseCase = ReturnType<typeof createApplyPaymentEventUseCase>;
