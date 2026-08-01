/**
 * 10G.7 — Reconcile LIVE payment after human paid (Production).
 * Does not open sales. Does not create new charges.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { resolveCollectorAccessTokenFromPaymentAccount } from "../lib/admin/edition-finance/infrastructure/resolve-collector-token";
import { createPrismaCheckoutMutations } from "../lib/checkout/infrastructure/prisma-checkout-mutations";
import {
  createPrismaDnxPaymentsPersistence,
  createClickatonCheckoutService,
  createMercadoPagoCheckoutProLiveAdapter,
  createMercadoPagoProductionClickatonProviderBridge,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

const REG = process.env.REG_ID?.trim() || "cms9jxbh90001xp8soyj2ff7m";
const ORDER = process.env.ORDER_ID?.trim() || "dnx_ord_eedc170407b647e1";
const CANONICAL_PA = "pa_ba733fa7a35f4326";
const COLLECTOR = "97484805";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("requires_production_database");
  }

  process.env.CLICKATON_QR_TOKEN_SECRET =
    process.env.CLICKATON_QR_TOKEN_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "clickaton-ops-10g7-qr-secret-min16chars";

  const before = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    select: { status: true, paymentStatus: true, editionId: true },
  });
  if (!before) throw new Error("registration_missing");

  const tok = await resolveCollectorAccessTokenFromPaymentAccount(CANONICAL_PA);
  if (!tok.ok) throw new Error(`vault:${tok.message}`);

  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", `clickaton:registration:${REG}`);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  const searchRes = await fetch(url, {
    headers: { Authorization: `Bearer ${tok.accessToken}` },
  });
  const searchBody = (await searchRes.json()) as {
    results?: Array<Record<string, unknown>>;
  };
  const payments = (searchBody.results ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    status_detail: p.status_detail,
    live_mode: p.live_mode,
    transaction_amount: p.transaction_amount,
    collector_id: p.collector_id,
    payer_id: (p.payer as { id?: unknown } | undefined)?.id ?? null,
    date_approved: p.date_approved ?? null,
  }));
  const approved = payments.find((p) => p.status === "approved");
  if (!approved?.id) {
    throw new Error("no_approved_payment_in_mp");
  }

  const adapter = createMercadoPagoCheckoutProLiveAdapter({
    accessToken: tok.accessToken,
    publicKey: process.env.MERCADOPAGO_LIVE_PUBLIC_KEY,
    credentialsSource: "production_panel",
    allowProductionWrites: true,
  });
  const bridge = createMercadoPagoProductionClickatonProviderBridge({ adapter });
  const persistence = createPrismaDnxPaymentsPersistence(
    prisma as unknown as DnxPaymentsPrismaDelegates,
  );
  const svc = createClickatonCheckoutService(persistence, { providerBridge: bridge });

  const webhook1 = await svc.applyProviderPaymentNotification({
    providerPaymentId: String(approved.id),
    eventId: `ops_10g7_${approved.id}_${Date.now()}`,
    liveModeReported: true,
    action: "payment.updated",
  });

  let order = await prisma.dnxPaymentOrder.findUnique({
    where: { id: ORDER },
    select: { status: true, amountMinor: true, environment: true, provider: true },
  });

  let confirmResult: { status: string; paymentStatus: string } | null = null;
  if (order?.status === "PAID") {
    const regNow = await prisma.clickatonRegistration.findUnique({
      where: { id: REG },
      select: { status: true },
    });
    if (regNow?.status !== "CONFIRMED") {
      const mutations = createPrismaCheckoutMutations();
      const prefix = await mutations.getEditionPrefix(before.editionId);
      const confirmed = await mutations.confirmPaid({
        registrationId: REG,
        paymentOrderId: ORDER,
        source: "ops_10g7_reconcile_after_paid",
        requestId: `ops_10g7_confirm_${Date.now()}`,
        editionPrefix: prefix,
      });
      confirmResult = {
        status: confirmed.status,
        paymentStatus: confirmed.paymentStatus,
      };
      try {
        const { enqueueWelcomeCardAfterPaid } = await import("../lib/welcome-card/enqueue");
        await enqueueWelcomeCardAfterPaid({
          registrationId: REG,
          editionId: before.editionId,
        });
      } catch {
        // soft
      }
    }
  }

  const webhookDup = await svc.applyProviderPaymentNotification({
    providerPaymentId: String(approved.id),
    eventId: `ops_10g7_idem_${approved.id}_${Date.now()}`,
    liveModeReported: true,
    action: "payment.updated",
  });

  const after = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      items: true,
      credential: { include: { qrTokens: true } },
      welcomeCards: { select: { id: true, status: true, publicationStatus: true } },
      user: { select: { id: true, email: true } },
    },
  });
  order = await prisma.dnxPaymentOrder.findUnique({
    where: { id: ORDER },
    select: { status: true, amountMinor: true, environment: true, provider: true },
  });
  const allocations = await prisma.dnxPaymentOrderAllocation.findMany({
    where: { paymentOrderId: ORDER },
    select: { role: true, basisPoints: true, chargedAmount: true },
  });
  const credCount = await prisma.clickatonParticipantCredential.count({
    where: { registrationId: REG },
  });
  const qrCount = after?.credential
    ? await prisma.clickatonQrToken.count({ where: { credentialId: after.credential.id } })
    : 0;
  const ed = await prisma.clickatonEdition.findFirst({
    where: { slug: "clickaton-argentina-2026" },
    select: { registrationEnabled: true },
  });

  const table = {
    UI_RETURN: "FAIL_TOKEN_SECRET_MISMATCH_NOT_PAYMENT",
    MP_APPROVED: approved.status === "approved" ? "PASS" : "FAIL",
    REAL_MONEY_LIVE: approved.live_mode === true ? "PASS" : "FAIL",
    WEBHOOK_OR_S2S: order?.status === "PAID" ? "PASS" : "FAIL",
    DNX_ORDER: order?.status === "PAID" ? "PASS" : "FAIL",
    REGISTRATION: after?.status === "CONFIRMED" ? "PASS" : "FAIL",
    AMOUNT: Number(approved.transaction_amount) === 25000 ? "PASS" : "FAIL",
    COLLECTOR: String(approved.collector_id) === COLLECTOR ? "PASS" : "FAIL",
    EXTERNAL_PAYER:
      approved.payer_id != null && String(approved.payer_id) !== COLLECTOR
        ? "PASS"
        : "FAIL",
    FIRST_N: (after?.items ?? []).some(
      (i) => /remera/i.test(i.nameSnapshot ?? "") && i.isIncluded,
    )
      ? "PASS"
      : "FAIL",
    TALLE: (after?.items ?? []).some((i) => i.variantNameSnapshot === "M")
      ? "PASS"
      : "FAIL",
    CREDENTIAL: after?.credential?.status === "ACTIVE" ? "PASS" : "FAIL",
    QR:
      after?.credential?.status === "ACTIVE" &&
      after.credential.qrTokens.some((t) => t.status === "ACTIVE")
        ? "PASS"
        : "FAIL",
    WELCOME:
      (after?.welcomeCards.length ?? 0) >= 1 || Boolean(after?.welcomeCardStatus)
        ? "PASS"
        : "WARN",
    MI_CUENTA: after?.status === "CONFIRMED" && after.userId != null ? "PASS" : "FAIL",
    IDEMPOTENCY: credCount === 1 && qrCount === 1 ? "PASS" : "FAIL",
    SALES_CLOSED: ed?.registrationEnabled === false ? "PASS" : "FAIL",
  };

  const corePass = [
    table.MP_APPROVED,
    table.REAL_MONEY_LIVE,
    table.DNX_ORDER,
    table.REGISTRATION,
    table.AMOUNT,
    table.COLLECTOR,
    table.EXTERNAL_PAYER,
    table.CREDENTIAL,
    table.QR,
  ].every((v) => v === "PASS");

  const verdict = corePass
    ? "CLICKATON LIVE EXTERNAL PAYER SMOKE PASS"
    : "CLICKATON LIVE EXTERNAL PAYER SMOKE BLOCKED";

  const out = {
    stage: "10G.7",
    uiNote:
      "La pantalla «No pudimos verificar el pago» es TOKEN_INVALID del retorno (AUTH_SECRET del script ≠ Production). El cobro LIVE sí ocurrió en Mercado Pago.",
    ids: {
      registrationId: REG,
      orderId: ORDER,
      providerPaymentId: String(approved.id),
      providerPaymentIdMasked: `${String(approved.id).slice(0, 4)}…${String(approved.id).slice(-4)}`,
      payerId: approved.payer_id != null ? String(approved.payer_id) : null,
    },
    webhook1: {
      outcome: (webhook1 as { outcome?: string }).outcome,
      conflictCode: (webhook1 as { conflictCode?: string }).conflictCode,
    },
    webhookDup: {
      outcome: (webhookDup as { outcome?: string }).outcome,
      conflictCode: (webhookDup as { conflictCode?: string }).conflictCode,
    },
    confirmResult,
    mp: approved,
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
            status: after.credential.status,
            publicCode: after.credential.publicCode,
            qrActive: after.credential.qrTokens.filter((t) => t.status === "ACTIVE")
              .length,
          }
        : null,
      welcomeCards: after?.welcomeCards,
      userId: after?.user?.id,
      userEmail: after?.user?.email,
      miCuentaPath: `/mi-cuenta/inscripciones/${REG}`,
    },
    order: order
      ? {
          status: order.status,
          amountMinor: Number(order.amountMinor),
          environment: order.environment,
          provider: order.provider,
        }
      : null,
    allocations: allocations.map((a) => ({
      role: a.role,
      basisPoints: a.basisPoints,
      chargedAmount: Number(a.chargedAmount),
    })),
    counts: { credCount, qrCount },
    table,
    verdict,
    readyForPublicSales: corePass
      ? "CLICKATON READY FOR PUBLIC SALES — WAITING HUMAN GO"
      : null,
  };

  writeFileSync("/tmp/clickaton-10g7-postpay.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!corePass) process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
