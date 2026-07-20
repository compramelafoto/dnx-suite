import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";
import type { DurableDnxPaymentsClient } from "../infrastructure/durable-dnx-payments-client";

export type ReconcileRegistrationPaymentResult = {
  status: "CONSISTENT" | "REPAIRED" | "MANUAL_REVIEW";
  findings: string[];
  actions: string[];
};

export function createReconcileRegistrationPaymentUseCase(deps: {
  payments: DnxPaymentsClient;
  registrationPort: CheckoutRegistrationPort;
}) {
  return {
    async execute(input: {
      registrationId: string;
    }): Promise<ReconcileRegistrationPaymentResult> {
      const registration = await deps.registrationPort.getRegistration(input.registrationId);
      if (!registration) {
        return {
          status: "MANUAL_REVIEW",
          findings: ["registration_not_found"],
          actions: [],
        };
      }

      const holds = await deps.registrationPort.getHoldSnapshot(registration.id);
      const durable = deps.payments as DurableDnxPaymentsClient;
      if (!durable.service?.reconcile) {
        // Fallback mínimo sin servicio durable
        if (!registration.paymentOrderId && registration.status === "CONFIRMED") {
          return {
            status: "MANUAL_REVIEW",
            findings: ["confirmed_without_payment_order"],
            actions: [],
          };
        }
        return { status: "CONSISTENT", findings: [], actions: [] };
      }

      return durable.service.reconcile({
        registrationId: registration.id,
        registrationStatus: registration.status,
        registrationPaymentStatus: registration.paymentStatus,
        paymentOrderId: registration.paymentOrderId ?? null,
        registrationAmountMinor: registration.money.totalAmount,
        registrationCurrency: registration.money.currency,
        capacityHoldActive: holds.capacityHoldActive,
      });
    },
  };
}
