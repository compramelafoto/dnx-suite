import { createCheckoutService, type CheckoutService } from "../application/checkout-service";
import { createPrismaCheckoutMutations } from "../infrastructure/prisma-checkout-mutations";
import {
  createInMemoryDnxPaymentsClient,
  createInMemoryDnxPaymentsStore,
} from "../infrastructure/in-memory-dnx-payments-client";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createCheckoutLogSink } from "../domain/observability";

type G = {
  __clickatonCheckoutService?: CheckoutService;
};

function g(): G {
  return globalThis as unknown as G;
}

export function setCheckoutServiceForTests(service: CheckoutService | null) {
  const globals = g();
  if (service) globals.__clickatonCheckoutService = service;
  else delete globals.__clickatonCheckoutService;
}

/**
 * Runtime productivo: cliente DNX Payments in-process (fake provider hasta smoke 10D3H).
 * No usa SDK Mercado Pago ni credenciales en Clickatón.
 * Variable CLICKATON_DNX_PAYMENTS_MODE=fake|memory (default fake).
 */
export function getCheckoutService(): CheckoutService {
  const override = g().__clickatonCheckoutService;
  if (override) return override;

  const store = createInMemoryDnxPaymentsStore({
    webhookSecret: process.env.DNX_PAYMENTS_WEBHOOK_SECRET ?? "dev-only-webhook-secret",
    checkoutBaseUrl:
      process.env.CLICKATON_FAKE_CHECKOUT_BASE_URL ?? "https://payments.test/checkout",
  });
  const payments = createInMemoryDnxPaymentsClient(store);

  return createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments,
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
  });
}
