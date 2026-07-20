import { prisma } from "@repo/db";
import {
  createInMemoryDnxPaymentsPersistence,
  createPrismaDnxPaymentsPersistence,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";
import { createCheckoutService, type CheckoutService } from "../application/checkout-service";
import { createPrismaCheckoutMutations } from "../infrastructure/prisma-checkout-mutations";
import {
  createInMemoryDnxPaymentsClient,
  createInMemoryDnxPaymentsStore,
} from "../infrastructure/in-memory-dnx-payments-client";
import { createDurableDnxPaymentsClient } from "../infrastructure/durable-dnx-payments-client";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createCheckoutLogSink } from "../domain/observability";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";

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

function paymentsMode(): "memory" | "durable-memory" | "prisma" {
  const raw = (process.env.CLICKATON_DNX_PAYMENTS_MODE ?? "prisma").toLowerCase();
  if (raw === "memory" || raw === "fake") return "memory";
  if (raw === "durable-memory") return "durable-memory";
  return "prisma";
}

function buildPaymentsClient(): DnxPaymentsClient {
  const webhookSecret = process.env.DNX_PAYMENTS_WEBHOOK_SECRET ?? "dev-only-webhook-secret";
  const checkoutBaseUrl =
    process.env.CLICKATON_FAKE_CHECKOUT_BASE_URL ?? "https://payments.test/checkout";
  const mode = paymentsMode();

  if (mode === "memory") {
    const store = createInMemoryDnxPaymentsStore({ webhookSecret, checkoutBaseUrl });
    return createInMemoryDnxPaymentsClient(store);
  }

  if (mode === "durable-memory") {
    return createDurableDnxPaymentsClient({
      persistence: createInMemoryDnxPaymentsPersistence(),
      webhookSecret,
      checkoutBaseUrl,
      isTestFixture: true,
    });
  }

  return createDurableDnxPaymentsClient({
    persistence: createPrismaDnxPaymentsPersistence(
      prisma as unknown as DnxPaymentsPrismaDelegates,
    ),
    webhookSecret,
    checkoutBaseUrl,
    isTestFixture: process.env.NODE_ENV !== "production",
  });
}

/**
 * Runtime: DNX Payments durable (Prisma) por defecto.
 * `memory` solo para selfchecks unitarios legacy.
 * Llamada interna tipada vía `@repo/payments/next`.
 */
export function getCheckoutService(): CheckoutService {
  const override = g().__clickatonCheckoutService;
  if (override) return override;

  return createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments: buildPaymentsClient(),
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
  });
}
