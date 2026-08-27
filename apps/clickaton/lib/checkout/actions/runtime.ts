import { prisma } from "@repo/db";
import {
  createInMemoryDnxPaymentsPersistence,
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoCheckoutProLiveAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  createMercadoPagoProductionClickatonProviderBridge,
  createMercadoPagoOrders1nClickatonBridge,
  resolveClickatonPaymentsProviderMode,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  isClickatonDnxCheckoutEnabled,
  isOrders1nStagingFlagEnabled,
  buildClickatonOperationalSnapshot,
  isSandboxAccessToken,
  mapMercadoPagoOrderResponse,
  type DnxPaymentsPrismaDelegates,
  type ClickatonCheckoutProviderBridge,
  type FetchCanonicalOrder,
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

function parseAmountToMinor(amount: string | undefined): string | null {
  if (!amount) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n * 100));
}

function buildOrdersHttp(): {
  adapter: MercadoPagoOrdersAdapter;
  fetchOrdersCanonical: FetchCanonicalOrder;
} | null {
  const token = readOptionalEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  const owner = readOptionalEnv("MERCADOPAGO_TEST_OWNER_USER_ID");
  if (!token || !owner || !isSandboxAccessToken(token)) return null;
  const config = createMercadoPagoProviderConfig({
    environment: "sandbox",
    accessToken: token,
    ...(readOptionalEnv("MERCADOPAGO_TEST_PUBLIC_KEY")
      ? { publicKey: readOptionalEnv("MERCADOPAGO_TEST_PUBLIC_KEY") }
      : {}),
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: owner,
    httpClient: http,
    enforceOrders1nStagingGate: true,
    confirmStaging: process.env.DNX_CONFIRM_STAGING === "true",
    confirmOrdersTest: process.env.DNX_CONFIRM_ORDERS_TEST === "true",
    verifyAfterCreate: true,
    allowTestFixtures: true,
    defaultStatementDescriptor: "CLICKATON",
  });
  const fetchOrdersCanonical: FetchCanonicalOrder = async (providerOrderId) => {
    const raw = await http.request<{
      id: string;
      status: string;
      status_detail?: string;
      external_reference?: string;
      total_amount?: string;
      currency?: string;
      splits?: Array<{ amount?: string }>;
      transactions?: { payments?: unknown[] };
    }>({ method: "GET", path: `/v1/orders/${providerOrderId}` });
    const body = raw.body;
    if (!body?.id) return null;
    const mapped = mapMercadoPagoOrderResponse(body as never);
    return {
      providerOrderId: mapped.providerOrderId,
      status: mapped.status,
      statusDetail: mapped.statusDetail ?? null,
      externalReference: body.external_reference ?? null,
      totalMinor: parseAmountToMinor(body.total_amount),
      currency: body.currency ?? "ARS",
      splitAmounts: (body.splits ?? []).map((s) => String(s.amount ?? "0")),
      paymentCount: body.transactions?.payments?.length ?? mapped.payments.length,
    };
  };
  return { adapter, fetchOrdersCanonical };
}

function resolveProviderBridge(): {
  bridge: ClickatonCheckoutProviderBridge | undefined;
  fetchOrdersCanonical?: FetchCanonicalOrder;
  buildOperationalSnapshot?: Parameters<
    typeof createDurableDnxPaymentsClient
  >[0]["buildOperationalSnapshot"];
} {
  const mode = resolveClickatonPaymentsProviderMode(
    readOptionalEnv("CLICKATON_DNX_PAYMENTS_PROVIDER") ?? "manual",
  );

  if (mode === "manual") {
    return { bridge: undefined };
  }

  if (mode === "mercado_pago_production") {
    // LIVE path: Preferences use collector OAuth (edition finance).
    // Base token (env or vault-warmed) used for S2S refresh/webhook reads.
    const liveToken =
      readOptionalEnv("MERCADOPAGO_LIVE_ACCESS_TOKEN") ||
      readOptionalEnv("MERCADOPAGO_ACCESS_TOKEN") ||
      "live-collector-oauth-required";
    const adapter = createMercadoPagoCheckoutProLiveAdapter({
      accessToken: liveToken,
      publicKey: readOptionalEnv("MERCADOPAGO_LIVE_PUBLIC_KEY"),
    });
    return {
      bridge: createMercadoPagoProductionClickatonProviderBridge({ adapter }),
    };
  }

  if (mode === "mercado_pago_orders_test") {
    if (!isClickatonDnxCheckoutEnabled() || !isOrders1nStagingFlagEnabled()) {
      throw new Error(
        "mercado_pago_orders_test_requires_DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED_and_DNX_MP_ORDERS_1N_STAGING_ENABLED",
      );
    }
    const orders = buildOrdersHttp();
    if (!orders) {
      throw new Error("mercado_pago_orders_test_requires_sandbox_token_and_owner");
    }
    const receiver1 = readOptionalEnv("MERCADOPAGO_TEST_PARTNER_RECEIVER_ID");
    const receiver2 = readOptionalEnv("MERCADOPAGO_TEST_PARTNER_RECEIVER_ID_2");
    // Brick supplies token/device per request; env fallbacks remain for CLI smokes only.
    const paymentToken = readOptionalEnv("MERCADOPAGO_TEST_PAYMENT_TOKEN");
    const deviceId = readOptionalEnv("MERCADOPAGO_TEST_DEVICE_ID");
    if (!receiver1 || !receiver2) {
      throw new Error("mercado_pago_orders_test_missing_partner_receivers");
    }
    const bridge = createMercadoPagoOrders1nClickatonBridge({
      adapter: orders.adapter,
      ownerUserId: readOptionalEnv("MERCADOPAGO_TEST_OWNER_USER_ID")!,
      partnerReceiverId: receiver1,
      partnerReceiverId2: receiver2,
      ...(paymentToken ? { paymentToken } : {}),
      ...(deviceId ? { deviceSessionId: deviceId } : {}),
      confirmStaging: process.env.DNX_CONFIRM_STAGING === "true",
      confirmOrdersTest: process.env.DNX_CONFIRM_ORDERS_TEST === "true",
      statementDescriptor: "CLICKATON",
    });
    return {
      bridge,
      fetchOrdersCanonical: orders.fetchOrdersCanonical,
      buildOperationalSnapshot: async (input) =>
        buildClickatonOperationalSnapshot({
          prisma,
          totalMinor: input.totalMinor,
          externalReference: input.externalReference,
          paymentIntentId: input.paymentIntentId,
          paymentOrderId: input.paymentOrderId,
        }),
    };
  }

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
  const orders = buildOrdersHttp();
  return {
    bridge: createMercadoPagoTestClickatonProviderBridge({ adapter }),
    fetchOrdersCanonical: orders?.fetchOrdersCanonical,
  };
}

type PaymentsG = {
  __clickatonDnxPaymentsClient?: DnxPaymentsClient;
};

function paymentsG(): PaymentsG {
  return globalThis as unknown as PaymentsG;
}

function buildPaymentsClient(): DnxPaymentsClient {
  const webhookSecret = process.env.DNX_PAYMENTS_WEBHOOK_SECRET ?? "dev-only-webhook-secret";
  /**
   * Secreto de firma de Mercado Pago (`x-signature`): lo genera MP en su panel
   * al registrar la URL de notificaciones. Va separado del HMAC interno DNX.
   * Ausente ⇒ se usa el interno (comportamiento actual, sin romper nada).
   */
  const mercadoPagoWebhookSecret = readOptionalEnv("MERCADOPAGO_WEBHOOK_SECRET");
  const checkoutBaseUrl =
    process.env.CLICKATON_FAKE_CHECKOUT_BASE_URL ?? "https://payments.test/checkout";
  const publicUrl = readOptionalEnv("CLICKATON_PUBLIC_URL");
  const webhookPublic =
    readOptionalEnv("DNX_PAYMENTS_WEBHOOK_PUBLIC_URL") ??
    (publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/webhooks/dnx-payments` : undefined);
  const mode = paymentsMode();
  const resolved = resolveProviderBridge();
  const providerBridge = resolved.bridge;
  const fetchOrdersCanonical =
    resolved.fetchOrdersCanonical ?? buildOrdersHttp()?.fetchOrdersCanonical;

  if (mode === "memory") {
    if (
      providerBridge?.mode === "mercado_pago_test" ||
      providerBridge?.mode === "mercado_pago_orders_test" ||
      providerBridge?.mode === "mercado_pago_production"
    ) {
      throw new Error("mercado_pago_incompatible_with_memory_mode");
    }
    const store = createInMemoryDnxPaymentsStore({ webhookSecret, checkoutBaseUrl });
    return createInMemoryDnxPaymentsClient(store);
  }

  if (mode === "durable-memory") {
    return createDurableDnxPaymentsClient({
      persistence: createInMemoryDnxPaymentsPersistence(),
      webhookSecret,
      ...(mercadoPagoWebhookSecret ? { mercadoPagoWebhookSecret } : {}),
      checkoutBaseUrl,
      notificationUrl: webhookPublic,
      providerBridge,
      isTestFixture: true,
      fetchOrdersCanonical,
      buildOperationalSnapshot: resolved.buildOperationalSnapshot,
    });
  }

  return createDurableDnxPaymentsClient({
    persistence: createPrismaDnxPaymentsPersistence(
      prisma as unknown as DnxPaymentsPrismaDelegates,
    ),
    webhookSecret,
    ...(mercadoPagoWebhookSecret ? { mercadoPagoWebhookSecret } : {}),
    checkoutBaseUrl,
    notificationUrl: webhookPublic,
    providerBridge,
    isTestFixture: process.env.NODE_ENV !== "production",
    fetchOrdersCanonical,
    buildOperationalSnapshot: resolved.buildOperationalSnapshot,
  });
}

/** Cliente DNX Payments compartido (inscripción + TIENDA). */
export function getDnxPaymentsClient(): DnxPaymentsClient {
  const globals = paymentsG();
  if (!globals.__clickatonDnxPaymentsClient) {
    globals.__clickatonDnxPaymentsClient = buildPaymentsClient();
  }
  return globals.__clickatonDnxPaymentsClient;
}

const CANONICAL_LIVE_COLLECTOR_PA = "pa_ba733fa7a35f4326";

/**
 * Runtime: DNX Payments durable (Prisma) por defecto.
 * Provider: manual|mercado_pago_test|mercado_pago_orders_test|mercado_pago_production
 * LIVE requires Production runtime + DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED (default OFF).
 * Orders TEST path requires staging flags ON (default OFF).
 */
export function getCheckoutService(): CheckoutService {
  const override = g().__clickatonCheckoutService;
  if (override) return override;

  const service = createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments: getDnxPaymentsClient(),
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
  });
  g().__clickatonCheckoutService = service;
  return service;
}

/**
 * LIVE: warm collector OAuth from vault into process env, then return service.
 * Use from webhooks / checkout routes so S2S refresh has a real token.
 */
export async function getCheckoutServiceReady(): Promise<CheckoutService> {
  const mode = resolveClickatonPaymentsProviderMode(
    readOptionalEnv("CLICKATON_DNX_PAYMENTS_PROVIDER") ?? "manual",
  );
  if (mode === "mercado_pago_production") {
    const existing =
      readOptionalEnv("MERCADOPAGO_LIVE_ACCESS_TOKEN") ||
      readOptionalEnv("MERCADOPAGO_ACCESS_TOKEN");
    if (!existing || existing === "live-collector-oauth-required") {
      const { resolveCollectorAccessTokenFromPaymentAccount } = await import(
        "@/lib/admin/edition-finance/infrastructure/resolve-collector-token"
      );
      const resolved = await resolveCollectorAccessTokenFromPaymentAccount(
        CANONICAL_LIVE_COLLECTOR_PA,
      );
      if (resolved.ok) {
        process.env.MERCADOPAGO_LIVE_ACCESS_TOKEN = resolved.accessToken;
        delete g().__clickatonCheckoutService;
        delete paymentsG().__clickatonDnxPaymentsClient;
      }
    }
  }
  return getCheckoutService();
}
