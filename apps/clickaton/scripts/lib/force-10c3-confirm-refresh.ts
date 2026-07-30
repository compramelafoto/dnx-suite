/**
 * One-shot 10C.3: refresh S2S de la orden del bundle (tras fix search-by-external_reference).
 * Confirma inscripción si MP ya tiene pago APPROVED.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createCheckoutService } from "../../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../../lib/checkout/infrastructure/prisma-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../../lib/checkout/domain/observability";
import { createPrismaPublicRegistrationRepository } from "../../lib/public-registration/infrastructure/prisma-public-registration-repository";
import { signRegistrationAccessToken } from "../../lib/public-registration/domain/access-token";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

function readEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

type Bundle = {
  ids: {
    registrationId: string;
    paymentOrderId: string | null;
    accessToken: string;
  };
  operator: { editionSlug: string };
};

async function main() {
  const bundle = JSON.parse(
    readFileSync("/tmp/clickaton_10c3_manual_bundle.json", "utf8"),
  ) as Bundle;
  const publicBaseUrl =
    process.env.CLICKATON_PUBLIC_URL?.replace(/\/$/, "") ||
    "https://clickaton-staging.vercel.app";

  const mpToken = readEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  const sourceRaw = process.env.MERCADOPAGO_CREDENTIALS_SOURCE ?? "unknown";
  const credentialsSource =
    sourceRaw === "credenciales_de_prueba"
      ? "credenciales_de_prueba"
      : sourceRaw === "production_panel"
        ? "production_panel"
        : "unknown";
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken: mpToken,
    publicKey: process.env.MERCADOPAGO_TEST_PUBLIC_KEY,
    credentialsSource,
  });
  const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
  const webhookSecret = readEnv("DNX_PAYMENTS_WEBHOOK_SECRET");
  const webhookPublic =
    process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ??
    `${publicBaseUrl}/api/webhooks/dnx-payments`;

  const payments = createDurableDnxPaymentsClient({
    persistence: createPrismaDnxPaymentsPersistence(
      prisma as unknown as DnxPaymentsPrismaDelegates,
    ),
    webhookSecret,
    checkoutBaseUrl: "https://payments.test/checkout",
    notificationUrl: webhookPublic,
    providerBridge: bridge,
    isTestFixture: true,
  });

  const checkout = createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments,
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
    publicBaseUrl,
  });

  const orderId = bundle.ids.paymentOrderId;
  if (!orderId) throw new Error("missing_payment_order_id");

  const before = await prisma.clickatonRegistration.findUnique({
    where: { id: bundle.ids.registrationId },
    select: { status: true, paymentStatus: true, paymentOrderId: true },
  });

  // Re-firmar con el secreto local del smoke env (el return a Staging usa otro secreto).
  const accessToken = signRegistrationAccessToken({
    registrationId: bundle.ids.registrationId,
    editionSlug: bundle.operator.editionSlug,
    expiresAtMs: Date.now() + 2 * 60 * 60_000,
  });

  // Si tenemos payment id acreditado, aplicarlo vía servicio durable (mismo path webhook S2S).
  const providerPaymentId = process.env.FORCE_MP_PAYMENT_ID?.trim();
  let webhookApply: unknown = null;
  if (providerPaymentId) {
    const {
      createClickatonCheckoutService,
      createPrismaDnxPaymentsPersistence: createPersist,
    } = await import("@repo/payments/next");
    const svc = createClickatonCheckoutService(
      createPersist(prisma as unknown as DnxPaymentsPrismaDelegates),
      { providerBridge: bridge },
    );
    webhookApply = await svc.applyProviderPaymentNotification({
      providerPaymentId,
      eventId: `force_10c3_${providerPaymentId}_${Date.now()}`,
      liveModeReported: true,
      action: "payment.updated",
    });
  }

  const refreshed = await checkout.refreshPaymentStatus({
    registrationId: bundle.ids.registrationId,
    editionSlug: bundle.operator.editionSlug,
    accessToken,
  });

  const after = await prisma.clickatonRegistration.findUnique({
    where: { id: bundle.ids.registrationId },
    select: {
      status: true,
      paymentStatus: true,
      userId: true,
      confirmedAt: true,
    },
  });

  const dnx = await prisma.dnxPaymentOrder.findUnique({
    where: { id: orderId },
    select: { status: true, environment: true },
  });

  const provider = await prisma.dnxProviderOrder.findFirst({
    where: { paymentOrderId: orderId },
    select: { providerStatus: true, mappedStatus: true },
  });

  console.log(
    JSON.stringify(
      {
        before,
        webhookApply:
          webhookApply && typeof webhookApply === "object"
            ? {
                outcome: (webhookApply as { outcome?: string }).outcome,
                conflictCode: (webhookApply as { conflictCode?: string }).conflictCode,
              }
            : webhookApply,
        refreshDto: {
          confirmed: refreshed.confirmed,
          pending: refreshed.pending,
          registrationStatus: refreshed.registrationStatus,
          paymentStatus: refreshed.paymentStatus,
          normalizedOrderStatus: refreshed.normalizedOrderStatus,
          message: refreshed.message?.slice(0, 160),
        },
        after: {
          ...after,
          userId:
            after?.userId != null ? `${String(after.userId).slice(0, 6)}…` : null,
        },
        dnx,
        provider,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});