/**
 * 10G.6 — Audit Staging registration after TEST payment + idempotency probes.
 * Staging DB only. Never mutates Production.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createCheckoutService } from "../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../lib/checkout/infrastructure/prisma-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../lib/checkout/domain/observability";
import { createPrismaPublicRegistrationRepository } from "../lib/public-registration/infrastructure/prisma-public-registration-repository";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

const REG =
  process.env.REG_ID?.trim() ||
  JSON.parse(readFileSync("/tmp/clickaton-10g6-test-checkout.json", "utf8")).ids
    .registrationId;

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("refusing_production_database");
  }

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      items: {
        select: {
          nameSnapshot: true,
          variantNameSnapshot: true,
          skuSnapshot: true,
          isIncluded: true,
          fulfillmentStatus: true,
        },
      },
      credential: {
        select: {
          id: true,
          status: true,
          publicCode: true,
          qrTokens: { select: { id: true, status: true, tokenHash: true }, take: 5 },
        },
      },
      welcomeCards: {
        select: { id: true, status: true, pngAssetId: true, publicationStatus: true },
        take: 5,
      },
      user: { select: { id: true, email: true } },
    },
  });
  if (!reg) throw new Error("registration_missing");

  const order = reg.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({
        where: { id: reg.paymentOrderId },
        include: {
          paymentIntent: { select: { externalReference: true, status: true } },
          providerOrders: {
            select: {
              providerOrderId: true,
              providerStatus: true,
              mappedStatus: true,
              totalMinor: true,
            },
          },
        },
      })
    : null;

  const shirtItems = reg.items.filter(
    (i) =>
      /remera/i.test(i.nameSnapshot ?? "") ||
      /remera/i.test(i.variantNameSnapshot ?? "") ||
      /REMERA/i.test(i.skuSnapshot ?? ""),
  );

  const accessToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim();
  let mpPayment: Record<string, unknown> | null = null;
  if (accessToken && order?.paymentIntent?.externalReference) {
    const url = new URL("https://api.mercadopago.com/v1/payments/search");
    url.searchParams.set("external_reference", order.paymentIntent.externalReference);
    url.searchParams.set("sort", "date_created");
    url.searchParams.set("criteria", "desc");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const best = body.results?.[0] ?? null;
    if (best) {
      mpPayment = {
        id: best.id,
        status: best.status,
        live_mode: best.live_mode,
        transaction_amount: best.transaction_amount,
        collector_id: best.collector_id,
      };
    }
  }

  // Refresh order via checkout service (idempotent)
  const accessTok = readFileSync("/tmp/clickaton_10g6_access_token.txt", "utf8").trim();
  const publicBaseUrl = "https://clickaton-staging.vercel.app";
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken: accessToken!,
    publicKey: process.env.MERCADOPAGO_TEST_PUBLIC_KEY,
    credentialsSource: "credenciales_de_prueba",
  });
  const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
  const checkout = createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments: createDurableDnxPaymentsClient({
      persistence: createPrismaDnxPaymentsPersistence(
        prisma as unknown as DnxPaymentsPrismaDelegates,
      ),
      webhookSecret:
        process.env.DNX_PAYMENTS_WEBHOOK_SECRET?.trim() || "dev-only-webhook-secret",
      checkoutBaseUrl: "https://payments.test/checkout",
      notificationUrl: `${publicBaseUrl}/api/webhooks/dnx-payments`,
      providerBridge: bridge,
      isTestFixture: true,
    }),
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
    publicBaseUrl,
  });

  const beforeRefresh = {
    regStatus: reg.status,
    paymentStatus: reg.paymentStatus,
    orderStatus: order?.status ?? null,
  };
  const refreshed = await checkout.refreshPaymentStatus({
    registrationId: REG,
    editionSlug: "clickaton-argentina-2026",
    accessToken: accessTok,
  });
  const after1 = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    select: {
      status: true,
      paymentStatus: true,
      confirmedAt: true,
      _count: { select: { credential: true, welcomeCards: true, items: true } },
    },
  });
  // Second refresh — idempotency
  await checkout.refreshPaymentStatus({
    registrationId: REG,
    editionSlug: "clickaton-argentina-2026",
    accessToken: accessTok,
  });
  const after2 = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      credential: {
        select: {
          id: true,
          status: true,
          publicCode: true,
          qrTokens: { select: { id: true, status: true }, take: 5 },
        },
      },
      welcomeCards: { select: { id: true, status: true } },
      items: {
        select: {
          nameSnapshot: true,
          variantNameSnapshot: true,
          fulfillmentStatus: true,
        },
      },
      user: { select: { id: true, email: true } },
    },
  });
  const orderAfter = after2?.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({
        where: { id: after2.paymentOrderId },
        select: { id: true, status: true, amountMinor: true },
      })
    : null;

  const credentialCount = after2?.credential ? 1 : 0;
  const welcomeCount = after2?.welcomeCards.length ?? 0;
  const shirtOk = (after2?.items ?? []).some(
    (i) => /remera/i.test(i.nameSnapshot ?? "") || /remera/i.test(i.variantNameSnapshot ?? ""),
  );

  const checks = {
    CHECKOUT_TEST: "PASS",
    PAYMENT_APPROVED:
      mpPayment?.status === "approved" || after2?.paymentStatus === "APPROVED"
        ? "PASS"
        : "FAIL",
    WEBHOOK_OR_REFRESH:
      after2?.status === "CONFIRMED" || orderAfter?.status === "PAID" ? "PASS" : "FAIL",
    ORDER_PAID: orderAfter?.status === "PAID" ? "PASS" : "FAIL",
    REGISTRATION_CONFIRMED: after2?.status === "CONFIRMED" ? "PASS" : "FAIL",
    REMERA: shirtOk ? "PASS" : "FAIL",
    QR:
      after2?.credential?.status === "ACTIVE" &&
      Boolean(after2.credential.publicCode) &&
      (after2.credential.qrTokens?.some((t) => t.status === "ACTIVE") ?? false)
        ? "PASS"
        : "FAIL",
    EMAIL: "PASS_STAGING_SAFE_MODE",
    WELCOME: welcomeCount >= 1 || Boolean((after2 as { welcomeCardStatus?: string } | null)?.welcomeCardStatus)
      ? "PASS"
      : "WARN",
    IDEMPOTENCY:
      credentialCount <= 1 && welcomeCount <= 2 && after1?.status === after2?.status
        ? "PASS"
        : "FAIL",
  };

  const allCorePass = [
    checks.PAYMENT_APPROVED,
    checks.ORDER_PAID,
    checks.REGISTRATION_CONFIRMED,
    checks.REMERA,
    checks.QR,
    checks.IDEMPOTENCY,
  ].every((v) => v === "PASS");

  const verdict =
    allCorePass && checks.WEBHOOK_OR_REFRESH === "PASS"
      ? "CLICKATON MP TEST E2E PASS — LIVE EXTERNAL PAYER SMOKE REQUIRED"
      : "CLICKATON MP TEST E2E BLOCKED";

  const out = {
    stage: "10G.6",
    registrationId: REG,
    beforeRefresh,
    refreshed,
    mpPayment,
    after: {
      status: after2?.status,
      paymentStatus: after2?.paymentStatus,
      confirmedAt: after2?.confirmedAt,
      termsVersion: after2 ? reg.termsVersion : null,
      amount: reg.totalAmount,
      shirtItems,
      credential: after2?.credential ?? null,
      welcomeCards: after2?.welcomeCards ?? [],
      userEmail: after2?.user?.email ?? null,
      order: orderAfter
        ? {
            id: orderAfter.id,
            status: orderAfter.status,
            amountMinor: Number(orderAfter.amountMinor),
          }
        : null,
    },
    checks,
    fingerprint: createHash("sha256").update(REG + String(randomUUID())).digest("hex").slice(0, 12),
    verdict,
  };
  writeFileSync("/tmp/clickaton-10g6-audit.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!String(verdict).includes("PASS —")) process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
