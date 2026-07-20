import {
  createInMemoryRegistrationRepository,
  formatVisibleCode,
} from "@/lib/registration/domain/in-memory";
import type { InMemoryPublicStore } from "@/lib/public-registration/infrastructure/in-memory-public-registration-repository";
import type { CheckoutRegistrationMutations } from "../domain/checkout-registration-port";
import { CheckoutError } from "../domain/errors";

export function createInMemoryCheckoutMutations(
  store: InMemoryPublicStore,
): CheckoutRegistrationMutations {
  const domainRegs = createInMemoryRegistrationRepository(store.domain);

  return {
    async getEditionPrefix(editionId) {
      const ed = store.editions.get(editionId);
      return ed?.visibleCodePrefix?.trim() || "CK";
    },

    async attachPaymentRefs(input) {
      const r = store.domain.registrations.get(input.registrationId);
      if (!r) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
      r.paymentOrderId = input.paymentOrderId;
      r.paymentProvider = input.paymentProvider;
      r.paymentExternalReference = input.paymentExternalReference;
      r.paymentIdempotencyKey = input.paymentIdempotencyKey;
      r.paymentStatus = input.paymentStatus;
      store.domain.registrations.set(r.id, r);
      store.domain.audits.push({
        registrationId: r.id,
        action: "CHECKOUT_ORDER_ATTACHED",
        source: "dnx_payments",
        metadata: {
          paymentOrderId: input.paymentOrderId,
          provider: input.paymentProvider,
        },
      });
      return structuredClone(r);
    },

    async confirmPaid(input) {
      const existing = store.domain.registrations.get(input.registrationId);
      if (!existing) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
      if (existing.status === "CONFIRMED" && existing.paymentStatus === "APPROVED") {
        return structuredClone(existing);
      }
      if (existing.paymentOrderId && existing.paymentOrderId !== input.paymentOrderId) {
        throw new CheckoutError(
          "PAYMENT_CONFLICT",
          "La orden no corresponde a esta inscripción.",
        );
      }

      const confirmed = await domainRegs.confirm({
        registrationId: input.registrationId,
        paymentStatus: "APPROVED",
        assignVisibleCode: !existing.visibleCode,
        editionPrefix: input.editionPrefix,
        source: input.source,
        requestId: input.requestId,
      });

      store.domain.audits.push({
        registrationId: confirmed.id,
        action: "PAYMENT_APPROVED_CONFIRMED",
        source: input.source,
        metadata: { paymentOrderId: input.paymentOrderId, requestId: input.requestId },
      });
      return confirmed;
    },

    async markPaymentStatus(input) {
      const r = store.domain.registrations.get(input.registrationId);
      if (!r) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
      const prev = { status: r.status, paymentStatus: r.paymentStatus };
      if (input.registrationStatus) r.status = input.registrationStatus;
      r.paymentStatus = input.paymentStatus;
      if (input.registrationStatus === "CANCELLED") r.cancelledAt = new Date();
      if (input.registrationStatus === "REFUNDED") r.refundedAt = new Date();
      store.domain.registrations.set(r.id, r);
      store.domain.statusHistory.push({
        registrationId: r.id,
        previousStatus: prev.status,
        newStatus: r.status,
        previousPaymentStatus: prev.paymentStatus,
        newPaymentStatus: r.paymentStatus,
      });
      store.domain.audits.push({
        registrationId: r.id,
        action: "PAYMENT_STATUS_UPDATED",
        source: input.source,
        metadata: { reason: input.reason, requestId: input.requestId },
      });
      return structuredClone(r);
    },

    async releaseForPaymentTerminal(input) {
      const r = store.domain.registrations.get(input.registrationId);
      if (!r) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
      if (r.status === "CONFIRMED" && r.paymentStatus === "APPROVED") {
        throw new CheckoutError(
          "PAYMENT_CONFLICT",
          "No se puede liberar una inscripción ya confirmada.",
        );
      }
      if (
        r.status === "CANCELLED" &&
        (r.paymentStatus === "EXPIRED" || r.paymentStatus === "CANCELLED")
      ) {
        return structuredClone(r);
      }

      const prev = { status: r.status, paymentStatus: r.paymentStatus };
      for (const h of store.domain.capacityHolds.values()) {
        if (h.registrationId === input.registrationId && h.status === "ACTIVE") {
          h.status = "EXPIRED";
          h.releasedAt = input.now;
        }
      }
      for (const h of store.domain.stockHolds.values()) {
        if (h.registrationId === input.registrationId && h.status === "ACTIVE") {
          const variant = store.domain.variants.get(h.productVariantId);
          if (variant) {
            variant.reservedStock = Math.max(0, variant.reservedStock - h.quantity);
          }
          const pub = store.variants.get(h.productVariantId);
          if (pub) {
            pub.reservedStock = Math.max(0, pub.reservedStock - h.quantity);
          }
          h.status = "EXPIRED";
          h.releasedAt = input.now;
        }
      }

      r.status = "CANCELLED";
      r.paymentStatus = input.paymentStatus;
      r.cancelledAt = input.now;
      store.domain.registrations.set(r.id, r);
      store.domain.statusHistory.push({
        registrationId: r.id,
        previousStatus: prev.status,
        newStatus: r.status,
        previousPaymentStatus: prev.paymentStatus,
        newPaymentStatus: r.paymentStatus,
      });
      store.domain.audits.push({
        registrationId: r.id,
        action: "PAYMENT_TERMINAL_RELEASE",
        source: input.source,
        metadata: { requestId: input.requestId, paymentStatus: input.paymentStatus },
      });
      return structuredClone(r);
    },
  };
}

/** Helper tests: asegura visible code format exportado. */
export { formatVisibleCode };
