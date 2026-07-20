import { prisma } from "@repo/db";
import {
  createInMemoryDnxPaymentsPersistence,
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  resolveClickatonPaymentsProviderMode,
  type DnxPaymentsPrismaDelegates,
  type ClickatonCheckoutProviderBridge,
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

function readOptionalEnv(name: string): string | undefined {
  return (process.env as Record<string, string | undefined>)[name]?.trim() || undefined;
}

function resolveProviderBridge(): ClickatonCheckoutProviderBridge | undefined {
  const mode = resolveClickatonPaymentsProviderMode(
    readOptionalEnv("CLICKATON_DNX_PAYMENTS_PROVIDER") ?? "manual",
  );
  if (mode === "manual") return undefined;

  const token = readOptionalEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  if (!token) {
    throw new Error("mercado_pago_test_requires_MERCADOPAGO_TEST_ACCESS_TOKEN");
  }
  const sourceRaw = readOptionalEnv("MERCADOPAGO_CREDENTIALS_SOURCE") ?? "unknown";
  const credentialsSource =
    sourceRaw === "credenciales_de_prueba"
      ? "credenciales_de_prueba"
      : sourceRaw === "production_panel"
        ? "production_panel"
        : "unknown";

  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken: token,
    publicKey: readOptionalEnv("MERCADOPAGO_TEST_PUBLIC_KEY"),
    credentialsSource,
  });
  return createMercadoPagoTestClickatonProviderBridge({ adapter });
}

function buildPaymentsClient(): DnxPaymentsClient {
  const webhookSecret = process.env.DNX_PAYMENTS_WEBHOOK_SECRET ?? "dev-only-webhook-secret";
  const checkoutBaseUrl =
    process.env.CLICKATON_FAKE_CHECKOUT_BASE_URL ?? "https://payments.test/checkout";
  const publicUrl = readOptionalEnv("CLICKATON_PUBLIC_URL");
  const webhookPublic =
    readOptionalEnv("DNX_PAYMENTS_WEBHOOK_PUBLIC_URL") ??
    (publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/webhooks/dnx-payments` : undefined);
  const mode = paymentsMode();
  const providerBridge = resolveProviderBridge();

  if (mode === "memory") {
    if (providerBridge?.mode === "mercado_pago_test") {
      throw new Error("mercado_pago_test_incompatible_with_memory_mode");
    }
    const store = createInMemoryDnxPaymentsStore({ webhookSecret, checkoutBaseUrl });
    return createInMemoryDnxPaymentsClient(store);
  }

  if (mode === "durable-memory") {
    return createDurableDnxPaymentsClient({
      persistence: createInMemoryDnxPaymentsPersistence(),
      webhookSecret,
      checkoutBaseUrl,
      notificationUrl: webhookPublic,
      providerBridge,
      isTestFixture: true,
    });
  }

  return createDurableDnxPaymentsClient({
    persistence: createPrismaDnxPaymentsPersistence(
      prisma as unknown as DnxPaymentsPrismaDelegates,
    ),
    webhookSecret,
    checkoutBaseUrl,
    notificationUrl: webhookPublic,
    providerBridge,
    isTestFixture: process.env.NODE_ENV !== "production",
  });
}

/**
 * Runtime: DNX Payments durable (Prisma) por defecto.
 * Provider: CLICKATON_DNX_PAYMENTS_PROVIDER=manual|mercado_pago_test (default manual).
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
