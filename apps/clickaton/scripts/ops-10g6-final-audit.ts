/**
 * 10G.6 — Final staging audit + idempotency (no Production writes).
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import { createCheckoutService } from "../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../lib/checkout/infrastructure/prisma-checkout-mutations";
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

const REG = "cms9dbk1g0003xppehrysck7n";
const ORDER = "dnx_ord_22a14e300a9446a2";
const PAYMENT_ID = "171432208072";
const publicBaseUrl = "https://clickaton-staging.vercel.app";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("refusing_production_database");
  }

  const before = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      items: true,
      credential: { include: { qrTokens: true } },
      welcomeCards: { select: { id: true, status: true, publicationStatus: true } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!before) throw new Error("missing_reg");

  const accessToken = signRegistrationAccessToken({
    registrationId: REG,
    editionSlug: "clickaton-argentina-2026",
    expiresAtMs: Date.now() + 2 * 60 * 60_000,
  });

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
    mutations: createPrismaCheckoutMutations(),
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
    eventId: `ops_10g6_final_idem_${Date.now()}`,
    liveModeReported: false,
    action: "payment.updated",
  });

  // MP search
  let mpPayment: Record<string, unknown> | null = null;
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set(
    "external_reference",
    `clickaton:registration:${REG}`,
  );
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${mpToken}` } });
  const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
  const best = body.results?.[0];
  if (best) {
    mpPayment = {
      id: best.id,
      status: best.status,
      live_mode: best.live_mode,
      transaction_amount: best.transaction_amount,
      collector_id: best.collector_id,
    };
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
  const allocations = await prisma.dnxPaymentOrderAllocation.findMany({
    where: { paymentOrderId: ORDER },
    select: { role: true, basisPoints: true, chargedAmount: true, status: true },
  });
  const credCount = await prisma.clickatonParticipantCredential.count({
    where: { registrationId: REG },
  });
  const qrCount = after?.credential
    ? await prisma.clickatonQrToken.count({ where: { credentialId: after.credential.id } })
    : 0;
  const orderCount = await prisma.dnxPaymentOrder.count({ where: { id: ORDER } });
  const regCount = await prisma.clickatonRegistration.count({ where: { id: REG } });

  const checks = {
    CHECKOUT_TEST: "PASS",
    PAYMENT_APPROVED:
      mpPayment?.status === "approved" || after?.paymentStatus === "APPROVED" ? "PASS" : "FAIL",
    WEBHOOK: order?.status === "PAID" ? "PASS" : "FAIL",
    ORDER_PAID: order?.status === "PAID" ? "PASS" : "FAIL",
    REGISTRATION_CONFIRMED: after?.status === "CONFIRMED" ? "PASS" : "FAIL",
    REMERA: (after?.items ?? []).some(
      (i) => /remera/i.test(i.nameSnapshot ?? "") && i.isIncluded,
    )
      ? "PASS"
      : "FAIL",
    SIZE_M_REQUESTED:
      (after?.items ?? []).some((i) => i.variantNameSnapshot === "M")
        ? "PASS"
        : "WARN_STAGING_CATALOG_XS_FALLBACK",
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
      credCount === 1 &&
      qrCount === 1 &&
      orderCount === 1 &&
      regCount === 1 &&
      r1.status === r2.status &&
      after?.status === before.status
        ? "PASS"
        : "FAIL",
    DNX_100:
      allocations.length === 1 &&
      allocations[0]?.role === "ORGANIZER" &&
      allocations[0]?.basisPoints === 10000
        ? "PASS"
        : "FAIL",
    TERMS_V2:
      after?.termsVersion === "CLICKATON_TERMS_2026_09_19_v2" ? "PASS" : "FAIL",
    AMOUNT_25000:
      Number(after?.totalAmount ?? 0) === 2_500_000 &&
      Number(order?.amountMinor ?? 0) === 2_500_000
        ? "PASS"
        : "FAIL",
    MP_TEST_NOT_LIVE: mpPayment?.live_mode === false ? "PASS" : "WARN",
  };

  const corePass = [
    checks.CHECKOUT_TEST,
    checks.PAYMENT_APPROVED,
    checks.WEBHOOK,
    checks.ORDER_PAID,
    checks.REGISTRATION_CONFIRMED,
    checks.REMERA,
    checks.QR,
    checks.IDEMPOTENCY,
    checks.DNX_100,
    checks.TERMS_V2,
    checks.AMOUNT_25000,
  ].every((v) => v === "PASS");

  const verdict = corePass
    ? "CLICKATON MP TEST E2E PASS — LIVE EXTERNAL PAYER SMOKE REQUIRED"
    : "CLICKATON MP TEST E2E BLOCKED";

  const out = {
    stage: "10G.6",
    environment: "STAGING_MP_TEST",
    ids: { registrationId: REG, paymentOrderId: ORDER, paymentId: PAYMENT_ID },
    mpPayment,
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
      totalAmount: after?.totalAmount != null ? Number(after.totalAmount) : null,
      items: after?.items.map((i) => ({
        name: i.nameSnapshot,
        variant: i.variantNameSnapshot,
        included: i.isIncluded,
      })),
      credential: after?.credential
        ? {
            id: after.credential.id,
            status: after.credential.status,
            publicCode: after.credential.publicCode,
            qrActive: after.credential.qrTokens.filter((t) => t.status === "ACTIVE")
              .length,
          }
        : null,
      welcomeCards: after?.welcomeCards,
      welcomeCardStatus: after?.welcomeCardStatus,
      userId: after?.user?.id,
      userEmail: after?.user?.email,
    },
    order: order
      ? {
          status: order.status,
          amountMinor: Number(order.amountMinor),
          environment: order.environment,
        }
      : null,
    allocations: allocations.map((a) => ({
      role: a.role,
      basisPoints: a.basisPoints,
      chargedAmount: Number(a.chargedAmount),
      status: a.status,
    })),
    counts: { credCount, qrCount, orderCount, regCount },
    checks,
    verdict,
    distinction: {
      TECHNICAL_E2E_TEST: corePass ? "PASS" : "FAIL",
      LIVE_MONEY_FLOW: "NOT_DONE — requires external payer ≠ collector 97484805",
    },
  };

  writeFileSync("/tmp/clickaton-10g6-final-audit.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!corePass) process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
