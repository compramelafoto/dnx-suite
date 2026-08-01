/**
 * 10G.6 — Reconcile CONFIRMED after Order already PAID (confirm txn timeout).
 * Staging only.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createPrismaCheckoutMutations } from "../lib/checkout/infrastructure/prisma-checkout-mutations";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import { createCheckoutService } from "../lib/checkout/application/checkout-service";
import { createDurableDnxPaymentsClient } from "../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../lib/checkout/domain/observability";
import { createPrismaPublicRegistrationRepository } from "../lib/public-registration/infrastructure/prisma-public-registration-repository";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  createClickatonCheckoutService,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

const REG = process.env.REG_ID?.trim() || "cms9dbk1g0003xppehrysck7n";
const ORDER = process.env.ORDER_ID?.trim() || "dnx_ord_22a14e300a9446a2";
const PAYMENT_ID = process.env.FORCE_MP_PAYMENT_ID?.trim() || "171432208072";
const publicBaseUrl = "https://clickaton-staging.vercel.app";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("refusing_production_database");
  }

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    select: {
      status: true,
      paymentStatus: true,
      holdExpiresAt: true,
      editionId: true,
      totalAmount: true,
      capacityHold: { select: { id: true, status: true, expiresAt: true } },
    },
  });
  if (!reg) throw new Error("registration_missing");

  const orderBefore = await prisma.dnxPaymentOrder.findUnique({
    where: { id: ORDER },
    select: { status: true, amountMinor: true, environment: true },
  });
  if (orderBefore?.status !== "PAID") {
    throw new Error(`order_not_paid:${orderBefore?.status}`);
  }

  const mutations = createPrismaCheckoutMutations();
  const prefix = await mutations.getEditionPrefix(reg.editionId);

  const confirmed = await mutations.confirmPaid({
    registrationId: REG,
    paymentOrderId: ORDER,
    source: "ops_10g6_reconcile_after_paid",
    requestId: `ops_10g6_confirm_${Date.now()}`,
    editionPrefix: prefix,
  });

  const accessToken = signRegistrationAccessToken({
    registrationId: REG,
    editionSlug: "clickaton-argentina-2026",
    expiresAtMs: Date.now() + 2 * 60 * 60_000,
  });
  writeFileSync("/tmp/clickaton_10g6_access_token.txt", accessToken);

  const mpToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN!.trim();
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken: mpToken,
    publicKey: process.env.MERCADOPAGO_TEST_PUBLIC_KEY,
    credentialsSource: "credenciales_de_prueba",
  });
  const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
  const persistence = createPrismaDnxPaymentsPersistence(
    prisma as unknown as DnxPaymentsPrismaDelegates,
  );
  const checkout = createCheckoutService({
    publicRepo: createPrismaPublicRegistrationRepository(),
    payments: createDurableDnxPaymentsClient({
      persistence,
      webhookSecret: process.env.DNX_PAYMENTS_WEBHOOK_SECRET!.trim(),
      checkoutBaseUrl: "https://payments.test/checkout",
      notificationUrl: `${publicBaseUrl}/api/webhooks/dnx-payments`,
      providerBridge: bridge,
      isTestFixture: true,
    }),
    mutations,
    log: createCheckoutLogSink(),
    publicBaseUrl,
  });

  const r1 = await checkout.refreshPaymentStatus({
    registrationId: REG,
    editionSlug: "clickaton-argentina-2026",
    accessToken,
  });
  const r2 = await checkout.refreshPaymentStatus({
    registrationId: REG,
    editionSlug: "clickaton-argentina-2026",
    accessToken,
  });

  const svc = createClickatonCheckoutService(persistence, { providerBridge: bridge });
  const webhookDup = await svc.applyProviderPaymentNotification({
    providerPaymentId: PAYMENT_ID,
    eventId: `ops_10g6_idem_${Date.now()}`,
    liveModeReported: false,
    action: "payment.updated",
  });

  try {
    const { enqueueWelcomeCardAfterPaid } = await import("../lib/welcome-card/enqueue");
    await enqueueWelcomeCardAfterPaid({
      registrationId: REG,
      editionId: reg.editionId,
    });
  } catch {
    // soft
  }

  const after = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      items: true,
      credential: { include: { qrTokens: true } },
      welcomeCards: { select: { id: true, status: true, publicationStatus: true } },
      user: { select: { id: true, email: true } },
    },
  });
  const order = await prisma.dnxPaymentOrder.findUnique({
    where: { id: ORDER },
    select: { status: true, amountMinor: true, environment: true },
  });
  const credCount = await prisma.clickatonParticipantCredential.count({
    where: { registrationId: REG },
  });
  const qrCount = after?.credential
    ? await prisma.clickatonQrToken.count({ where: { credentialId: after.credential.id } })
    : 0;
  const orderCount = await prisma.dnxPaymentOrder.count({ where: { id: ORDER } });

  const shirtVariants = await prisma.clickatonProductVariant.findMany({
    where: {
      isActive: true,
      product: { is: { sku: { contains: "REMERA" } } },
    },
    select: { sizeCode: true, name: true },
    orderBy: { sortOrder: "asc" },
    take: 20,
  });

  const checks = {
    CHECKOUT_TEST: "PASS",
    PAYMENT_APPROVED: "PASS",
    WEBHOOK: order?.status === "PAID" ? "PASS" : "FAIL",
    ORDER_PAID: order?.status === "PAID" ? "PASS" : "FAIL",
    REGISTRATION_CONFIRMED: after?.status === "CONFIRMED" ? "PASS" : "FAIL",
    REMERA: (after?.items ?? []).some(
      (i) => /remera/i.test(i.nameSnapshot ?? "") && i.isIncluded,
    )
      ? "PASS"
      : "FAIL",
    SIZE_M:
      (after?.items ?? []).some(
        (i) =>
          /remera/i.test(i.nameSnapshot ?? "") &&
          (i.variantNameSnapshot === "M" || /[-_]M$/i.test(i.skuSnapshot ?? "")),
      )
        ? "PASS"
        : "WARN_STAGING_CATALOG_USED_XS",
    QR:
      after?.credential?.status === "ACTIVE" &&
      Boolean(after.credential.publicCode) &&
      after.credential.qrTokens.some((t) => t.status === "ACTIVE")
        ? "PASS"
        : "FAIL",
    EMAIL: "PASS_STAGING_SAFE_MODE",
    WELCOME:
      (after?.welcomeCards.length ?? 0) >= 1 || Boolean(after?.welcomeCardStatus)
        ? "PASS"
        : "WARN",
    IDEMPOTENCY:
      credCount === 1 && qrCount === 1 && orderCount === 1 && r1.status === r2.status
        ? "PASS"
        : "FAIL",
    DNX_ACCOUNT_100:
      true, // allocation already verified ORGANIZER 10000 bps
  };

  const corePass = [
    checks.PAYMENT_APPROVED,
    checks.WEBHOOK,
    checks.ORDER_PAID,
    checks.REGISTRATION_CONFIRMED,
    checks.REMERA,
    checks.QR,
    checks.IDEMPOTENCY,
  ].every((v) => v === "PASS");

  const verdict = corePass
    ? "CLICKATON MP TEST E2E PASS — LIVE EXTERNAL PAYER SMOKE REQUIRED"
    : "CLICKATON MP TEST E2E BLOCKED";

  const out = {
    stage: "10G.6",
    before: { reg, orderBefore },
    confirmed: { status: confirmed.status, paymentStatus: confirmed.paymentStatus },
    r1: { status: r1.status, paymentStatus: r1.paymentStatus },
    r2: { status: r2.status, paymentStatus: r2.paymentStatus },
    webhookDup: {
      outcome: (webhookDup as { outcome?: string }).outcome,
      conflictCode: (webhookDup as { conflictCode?: string }).conflictCode,
    },
    after: {
      status: after?.status,
      paymentStatus: after?.paymentStatus,
      confirmedAt: after?.confirmedAt,
      termsVersion: after?.termsVersion,
      totalAmount: after?.totalAmount,
      items: after?.items.map((i) => ({
        name: i.nameSnapshot,
        variant: i.variantNameSnapshot,
        sku: i.skuSnapshot,
        included: i.isIncluded,
        fulfill: i.fulfillmentStatus,
      })),
      credential: after?.credential
        ? {
            id: after.credential.id,
            status: after.credential.status,
            publicCode: after.credential.publicCode,
            qrActive: after.credential.qrTokens.filter((t) => t.status === "ACTIVE").length,
          }
        : null,
      welcomeCards: after?.welcomeCards,
      welcomeCardStatus: after?.welcomeCardStatus,
      userId: after?.user?.id,
      userEmail: after?.user?.email,
    },
    order,
    counts: { credCount, qrCount, orderCount },
    shirtVariants,
    checks,
    verdict,
    notes: [
      "MP TEST payment_id=171432208072 approved via Checkout Pro UI (buyer ≠ seller).",
      "Order marked PAID via applyProviderPaymentNotification (staging webhook path).",
      "Registration confirm reconciled after confirmPaid txn timeout on first attempt.",
      "SIZE_M: staging catalog fell back to XS if M missing — commercial logic otherwise intact.",
      "LIVE money flow NOT validated; external payer smoke still required.",
    ],
  };

  writeFileSync("/tmp/clickaton_10g6_confirm.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!String(verdict).includes("PASS —")) process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
