/**
 * Observa CONFIRMED post-pago manual 10C.3 y valida cadena post-pago.
 * Lee /tmp/clickaton_10c3_manual_bundle.json (no imprime secretos).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createCheckoutService } from "../../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../../lib/checkout/infrastructure/prisma-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../../lib/checkout/domain/observability";
import { createPrismaPublicRegistrationRepository } from "../../lib/public-registration/infrastructure/prisma-public-registration-repository";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

type Bundle = {
  ids: {
    registrationId: string;
    paymentOrderId: string | null;
    preferenceId: string | null;
    accessToken: string;
  };
  operator: { editionSlug: string };
};

async function buildCheckout(publicBaseUrl: string) {
  const accessToken = readEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  const sourceRaw = process.env.MERCADOPAGO_CREDENTIALS_SOURCE ?? "unknown";
  const credentialsSource =
    sourceRaw === "credenciales_de_prueba"
      ? "credenciales_de_prueba"
      : sourceRaw === "production_panel"
        ? "production_panel"
        : "unknown";
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken,
    publicKey: process.env.MERCADOPAGO_TEST_PUBLIC_KEY,
    credentialsSource,
  });
  const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
  const webhookSecret = readEnv("DNX_PAYMENTS_WEBHOOK_SECRET");
  const webhookPublic =
    process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ??
    `${publicBaseUrl.replace(/\/$/, "")}/api/webhooks/dnx-payments`;
  return createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments: createDurableDnxPaymentsClient({
      persistence: createPrismaDnxPaymentsPersistence(
        prisma as unknown as DnxPaymentsPrismaDelegates,
      ),
      webhookSecret,
      checkoutBaseUrl: "https://payments.test/checkout",
      notificationUrl: webhookPublic,
      providerBridge: bridge,
      isTestFixture: true,
    }),
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
    publicBaseUrl,
  });
}

async function collectEvidence(registrationId: string) {
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    include: {
      items: {
        select: {
          productId: true,
          productVariantId: true,
          sourceType: true,
          quantity: true,
        },
      },
      capacityHold: { select: { status: true } },
      stockHolds: { select: { status: true }, take: 3 },
      credential: {
        select: {
          id: true,
          status: true,
          publicCode: true,
          qrTokens: {
            where: { status: "ACTIVE", revokedAt: null },
            select: { id: true, status: true },
            take: 5,
          },
        },
      },
    },
  });

  const order = reg?.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({
        where: { id: reg.paymentOrderId },
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          environment: true,
          isTestFixture: true,
        },
      })
    : null;

  const provider = reg?.paymentOrderId
    ? await prisma.dnxProviderOrder.findFirst({
        where: { paymentOrderId: reg.paymentOrderId },
        select: {
          id: true,
          providerOrderId: true,
          providerStatus: true,
          mappedStatus: true,
          environment: true,
        },
      })
    : null;

  const since = new Date(Date.now() - 6 * 60 * 60_000);
  const webhookInbox = await prisma.dnxPaymentWebhookInbox.findMany({
    where: {
      receivedAt: { gte: since },
      environment: "SANDBOX",
    },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      eventType: true,
      processingStatus: true,
      providerEventId: true,
      providerResourceId: true,
      environment: true,
      receivedAt: true,
      attempts: true,
    },
    take: 30,
  });

  const audits = await prisma.dnxPaymentAuditEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        ...(reg?.paymentOrderId ? [{ aggregateId: reg.paymentOrderId }] : []),
        { aggregateId: registrationId },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      result: true,
      correlationId: true,
      createdAt: true,
    },
    take: 30,
  });

  const outbox = await prisma.clickatonIntegrationOutboxEvent.findMany({
    where: { aggregateId: registrationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventType: true,
      status: true,
      idempotencyKey: true,
      createdAt: true,
    },
    take: 20,
  });

  const user = reg?.userId
    ? await prisma.user.findUnique({
        where: { id: reg.userId },
        select: { id: true, email: true, password: true },
      })
    : null;

  const resetTokens = user
    ? await prisma.passwordResetToken.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, usedAt: true, expiresAt: true, createdAt: true },
        take: 5,
      })
    : [];

  const userDupes = user?.email
    ? await prisma.user.count({
        where: { email: { equals: user.email, mode: "insensitive" } },
      })
    : 0;

  return {
    registration: reg
      ? {
          id: maskId(reg.id),
          status: reg.status,
          paymentStatus: reg.paymentStatus,
          userId: reg.userId,
          totalPesos: (reg.totalAmount ?? 0) / 100,
          itemCount: reg.items.length,
          hasMerchVariant: reg.items.some((i) => Boolean(i.productVariantId)),
          sourceTypes: [...new Set(reg.items.map((i) => i.sourceType))],
          capacityHold: reg.capacityHold?.status ?? null,
          stockHolds: reg.stockHolds.map((h) => h.status),
          confirmedAt: reg.confirmedAt?.toISOString() ?? null,
        }
      : null,
    order: order
      ? {
          id: maskId(order.id),
          status: order.status,
          amountMinor: Number(order.amountMinor),
          currency: order.currency,
          environment: order.environment,
          isTestFixture: order.isTestFixture,
        }
      : null,
    provider: provider
      ? {
          id: maskId(provider.id),
          providerOrderId: maskId(provider.providerOrderId),
          providerStatus: provider.providerStatus,
          mappedStatus: provider.mappedStatus,
          environment: provider.environment,
        }
      : null,
    webhookRecentTest: webhookInbox.map((w) => ({
      id: maskId(w.id),
      eventType: w.eventType,
      status: w.processingStatus,
      providerEventId: maskId(w.providerEventId),
      providerResourceId: maskId(w.providerResourceId),
      attempts: w.attempts,
      receivedAt: w.receivedAt.toISOString(),
    })),
    audits: audits.map((a) => ({
      id: maskId(a.id),
      action: a.action,
      result: a.result,
      correlationId: a.correlationId ? maskId(a.correlationId) : null,
      createdAt: a.createdAt.toISOString(),
    })),
    integrationOutbox: outbox.map((o) => ({
      id: maskId(o.id),
      eventType: o.eventType,
      status: o.status,
      idempotencyKey: maskId(o.idempotencyKey),
      createdAt: o.createdAt.toISOString(),
    })),
    credential: reg?.credential
      ? {
          id: maskId(reg.credential.id),
          status: reg.credential.status,
          publicCodeMasked: reg.credential.publicCode
            ? `${reg.credential.publicCode.slice(0, 4)}…`
            : null,
          activeQrCount: reg.credential.qrTokens.length,
        }
      : null,
    user: user
      ? {
          id: user.id,
          emailMasked: user.email
            ? `${user.email.slice(0, 3)}***@${user.email.split("@")[1] ?? ""}`
            : null,
          hasPassword: Boolean(user.password),
          duplicateEmailUsers: userDupes,
          resetTokenCount: resetTokens.length,
          unusedResetTokens: resetTokens.filter((t) => !t.usedAt).length,
        }
      : null,
  };
}

async function main() {
  const raw = readFileSync("/tmp/clickaton_10c3_manual_bundle.json", "utf8");
  const bundle = JSON.parse(raw) as Bundle;
  const registrationId = bundle.ids.registrationId;
  const editionSlug = bundle.operator.editionSlug;
  const accessToken = bundle.ids.accessToken;
  const publicBaseUrl = readEnv("CLICKATON_PUBLIC_URL");
  const checkout = await buildCheckout(publicBaseUrl);

  const pollMs = Number(process.env.SMOKE_MP_POLL_MS ?? "900000");
  const interval = Number(process.env.SMOKE_MP_POLL_INTERVAL_MS ?? "5000");
  const deadline = Date.now() + pollMs;
  console.log(
    JSON.stringify({
      watching: maskId(registrationId),
      editionSlug,
      pollMs,
    }),
  );

  let last: Awaited<ReturnType<typeof checkout.getPaymentStatus>> | null = null;
  while (Date.now() < deadline) {
    last = await checkout.refreshPaymentStatus({
      registrationId,
      editionSlug,
      accessToken,
    });
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        dnx: last.normalizedOrderStatus,
        reg: last.registrationStatus,
        pay: last.paymentStatus,
        confirmed: last.confirmed,
      }),
    );
    if (last.confirmed || last.registrationStatus === "CONFIRMED") break;
    if (
      last.normalizedOrderStatus === "REJECTED" ||
      last.normalizedOrderStatus === "CANCELLED"
    ) {
      break;
    }
    await sleep(interval);
  }

  const again = await checkout.refreshPaymentStatus({
    registrationId,
    editionSlug,
    accessToken,
  });
  // controlled second refresh for idempotency evidence
  const again2 = await checkout.refreshPaymentStatus({
    registrationId,
    editionSlug,
    accessToken,
  });
  const evidence = await collectEvidence(registrationId);
  const report = {
    at: new Date().toISOString(),
    poll: {
      last: {
        dnx: last?.normalizedOrderStatus ?? null,
        reg: last?.registrationStatus ?? null,
        pay: last?.paymentStatus ?? null,
        confirmed: last?.confirmed ?? false,
      },
      refresh2: {
        dnx: again.normalizedOrderStatus,
        reg: again.registrationStatus,
        pay: again.paymentStatus,
        confirmed: again.confirmed,
      },
      refresh3: {
        dnx: again2.normalizedOrderStatus,
        reg: again2.registrationStatus,
        pay: again2.paymentStatus,
        confirmed: again2.confirmed,
      },
      idempotentRefresh:
        again.normalizedOrderStatus === again2.normalizedOrderStatus &&
        again.confirmed === again2.confirmed &&
        again.registrationStatus === again2.registrationStatus,
    },
    evidence,
  };
  writeFileSync(
    "/tmp/clickaton_10c3_watch_evidence.json",
    JSON.stringify(report, null, 2),
  );

  const ok =
    evidence.registration?.status === "CONFIRMED" &&
    (evidence.registration.paymentStatus === "APPROVED" ||
      evidence.order?.status === "PAID" ||
      evidence.order?.status === "CAPTURED");

  console.log(
    JSON.stringify(
      {
        readyCandidate: ok,
        registrationStatus: evidence.registration?.status,
        paymentStatus: evidence.registration?.paymentStatus,
        orderStatus: evidence.order?.status,
        userId: evidence.registration?.userId,
        credential: evidence.credential,
        webhookRecentCount: evidence.webhookRecentTest.length,
        outboxCount: evidence.integrationOutbox.length,
        hasMerch: evidence.registration?.hasMerchVariant,
        idempotentRefresh: report.poll.idempotentRefresh,
      },
      null,
      2,
    ),
  );

  process.exit(ok ? 0 : 3);
}

main()
  .catch((e) => {
    console.error("WATCH_FAIL", e instanceof Error ? e.message.slice(0, 240) : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
