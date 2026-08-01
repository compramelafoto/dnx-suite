#!/usr/bin/env node
/**
 * IMPLEMENTACIÓN 05 — Sandbox REAL evidence orchestrator.
 *
 * Usage:
 *   pnpm --filter @repo/payments exec tsx src/cli/imp05-sandbox-evidence.ts --preflight
 *   pnpm --filter @repo/payments exec tsx src/cli/imp05-sandbox-evidence.ts --run \
 *     --confirm-staging --confirm-orders-test --confirm-refund-smoke
 *
 * Never prints secrets / tokens / full receiver IDs / PAN.
 * Production writes always blocked.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadSandboxEnvFromProcess,
  runSandboxPreflight,
} from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MercadoPagoSplitConsentAdapter,
  singleIntangibleItem,
  MP_API_BASE_URL,
} from "../providers/mercado-pago/index.js";
import { money } from "../money/index.js";
import { calculateDistribution } from "../distribution/index.js";
import type { PartnerConsentEvidence } from "../providers/mercado-pago/orders/consent-evidence.js";
import { AppendOnlyLedger } from "../ledger/index.js";
import {
  allocateRefundProportionally,
  createOrders1nRefundService,
  InMemoryRefundStore,
  postRefundLedgerEntries,
  reconcileMercadoPagoOrderRefunds,
} from "../application/services/orders-1n-refunds/index.js";
import type { PersistedRefundRecord } from "../application/services/orders-1n-refunds/types.js";

type Args = {
  mode: "preflight" | "run";
  confirmStaging: boolean;
  confirmOrdersTest: boolean;
  confirmRefundSmoke: boolean;
  reportDir: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: "preflight",
    confirmStaging: false,
    confirmOrdersTest: false,
    confirmRefundSmoke: false,
    reportDir: ".local/audit-imp05",
  };
  for (const a of argv) {
    if (a === "--preflight") args.mode = "preflight";
    if (a === "--run") args.mode = "run";
    if (a === "--confirm-staging") args.confirmStaging = true;
    if (a === "--confirm-orders-test") args.confirmOrdersTest = true;
    if (a === "--confirm-refund-smoke") args.confirmRefundSmoke = true;
    if (a.startsWith("--report-dir=")) args.reportDir = a.slice("--report-dir=".length);
  }
  return args;
}

function prefix(value: string | undefined | null, n = 8): string | null {
  if (!value) return null;
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}

function maskEmail(email: string | undefined | null): string | null {
  if (!email || !email.includes("@")) return null;
  const [u, d] = email.split("@");
  return `${(u ?? "").slice(0, 2)}…@${d}`;
}

function writeJson(dir: string, name: string, body: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, JSON.stringify(body, null, 2));
  return path;
}

function assertProductionSafety(): {
  ok: true;
  productionFlag: string;
  baseUrl: string;
} | { ok: false; reason: string } {
  const prodFlag = (process.env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "").trim().toLowerCase();
  if (prodFlag === "true" || prodFlag === "1" || prodFlag === "yes") {
    return { ok: false, reason: "PRODUCTION SAFETY BLOCKER: DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true" };
  }
  return {
    ok: true,
    productionFlag: prodFlag || "MISSING/OFF",
    baseUrl: MP_API_BASE_URL,
  };
}

async function evidenceConsent(
  consentAdapter: MercadoPagoSplitConsentAdapter,
  receiverId: string,
  label: string,
) {
  const got = await consentAdapter.getConsent(receiverId);
  return {
    label,
    receiverIdPrefix: prefix(receiverId),
    status: got?.status ?? "NOT_FOUND",
    sellerEmailMasked: maskEmail(got?.sellerEmail),
    realRemote: true,
    testFixture: false,
  };
}

/**
 * Mint a single-use TEST card token via public API.
 * Card data from env only (never logged). Returns null if env incomplete.
 */
async function mintFreshPaymentToken(publicKey: string | undefined): Promise<{
  token: string;
  paymentMethodId: string;
} | null> {
  const pk = publicKey?.trim();
  if (!pk) return null;
  const cardNumber = process.env.MERCADOPAGO_TEST_CARD_NUMBER?.replace(/\s+/g, "") ?? "";
  const expMonth = process.env.MERCADOPAGO_TEST_CARD_EXP_MONTH?.trim() ?? "";
  const expYear = process.env.MERCADOPAGO_TEST_CARD_EXP_YEAR?.trim() ?? "";
  const securityCode = process.env.MERCADOPAGO_TEST_CARD_SECURITY_CODE?.trim() ?? "";
  const cardholderName = process.env.MERCADOPAGO_TEST_CARDHOLDER_NAME?.trim() ?? "APRO";
  if (!cardNumber || !expMonth || !expYear || !securityCode) return null;

  const paymentMethodId =
    process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() ||
    (cardNumber.startsWith("5031") ? "master" : "visa");

  const url = new URL(`${MP_API_BASE_URL}/v1/card_tokens`);
  url.searchParams.set("public_key", pk);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: cardNumber,
      expiration_month: Number(expMonth),
      expiration_year: Number(expYear),
      security_code: securityCode,
      cardholder: {
        name: cardholderName,
        identification: {
          type: "DNI",
          number: process.env.MERCADOPAGO_TEST_CARDHOLDER_DOC?.trim() || "12345678",
        },
      },
    }),
  });
  const parsed = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!res.ok || !parsed?.id) return null;
  return { token: parsed.id, paymentMethodId };
}

async function createOrderSmoke(input: {
  adapter: MercadoPagoOrdersAdapter;
  ownerUserId: string;
  partners: Array<{ recipientId: string; receiverId: string; evidence: PartnerConsentEvidence }>;
  totalMinor: bigint;
  paymentToken: string;
  paymentMethodId?: string;
  deviceSessionId: string;
  externalReference: string;
  idempotencyKey: string;
  label: string;
}) {
  const total = money("ARS", input.totalMinor);
  const partnerIds = input.partners.map((p) => p.recipientId);
  const ownerId = "owner";
  const allIds = [ownerId, ...partnerIds];
  const equalBps = Math.floor(10_000 / allIds.length);
  const rules = allIds.map((recipientId, i) => ({
    recipientId,
    role: "OTHER" as const,
    kind: "PERCENTAGE" as const,
    percentageBps: i === 0 ? 10_000 - equalBps * (allIds.length - 1) : equalBps,
    priority: i + 1,
    optional: false,
  }));
  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: allIds,
  });

  const partnerReceiverIds = new Map(
    input.partners.map((p) => [p.recipientId, p.receiverId] as const),
  );
  const partnerConsentsByRecipientId = new Map(
    input.partners.map((p) => [p.recipientId, p.evidence] as const),
  );

  const created = await input.adapter.createSplitOrder({
    environment: "sandbox",
    externalReference: input.externalReference,
    total,
    distribution,
    idempotencyKey: input.idempotencyKey,
    deviceSessionId: input.deviceSessionId,
    paymentToken: input.paymentToken,
    paymentMethodId: input.paymentMethodId ?? "master",
    installments: 1,
    payerEmail: "buyer.imp05@testuser.com",
    statementDescriptor: "DNX TEST",
    items: [
      singleIntangibleItem({
        title: "Imp05 sandbox intangible",
        total,
        categoryId: "others",
        id: input.externalReference,
      }),
    ],
    partnerReceiverIds,
    partnerConsentsByRecipientId,
    metadata: { stage: "IMP05", label: input.label },
  });

  const got = await input.adapter.getOrder(created.providerOrderId, "sandbox");
  const allocSum = distribution.entries.reduce((s, e) => s + e.amount.amountMinor, 0n);

  return {
    label: input.label,
    partnerCount: input.partners.length,
    providerOrderIdPrefix: prefix(created.providerOrderId, 12),
    providerOrderId: created.providerOrderId, // kept in memory for refunds; stripped from published docs
    status: created.status,
    getStatus: got.status,
    getStatusDetail: got.statusDetail ?? null,
    paymentCount: got.payments.length,
    primaryPaymentIdPrefix: prefix(got.payments[0]?.providerPaymentId, 12),
    primaryPaymentId: got.payments[0]?.providerPaymentId ?? null,
    totalMinor: input.totalMinor.toString(),
    allocationSumMinor: allocSum.toString(),
    allocationMatch: allocSum === input.totalMinor,
    externalReference: input.externalReference,
    amountType: "fixed_preferred",
    payerEmailMasked: "bu…@testuser.com",
    statementDescriptor: "DNX TEST",
    idempotencyPresent: true,
    meliSessionPresent: true,
    payments: got.payments.map((p) => ({
      idPrefix: prefix(p.providerPaymentId, 12),
      status: p.status,
      amountMinor: p.amount.amountMinor.toString(),
    })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd(), "../..");
  const reportDir = resolve(repoRoot, args.reportDir);

  const safety = assertProductionSafety();
  if (!safety.ok) {
    console.error(JSON.stringify({ ok: false, reason: safety.reason }));
    process.exitCode = 99;
    return;
  }

  const envInput = loadSandboxEnvFromProcess(process.env, { cwd: repoRoot });
  const confirmed =
    args.confirmStaging && args.confirmOrdersTest && args.mode === "run";
  const preflight = runSandboxPreflight({
    ...envInput,
    dryRun: args.mode !== "run",
    confirm: confirmed,
    requirePaymentToken: true,
  });

  const preflightReport = {
    stage: "IMP05",
    mode: args.mode,
    environment: "sandbox",
    productionSafety: safety,
    preflightStatus: preflight.status,
    checks: preflight.checks,
    presence: {
      accessToken: envInput.accessToken ? "SET" : "MISSING",
      publicKey: envInput.publicKey ? "SET" : "MISSING",
      ownerUserId: envInput.ownerUserId ? "SET" : "MISSING",
      partnerEmail: envInput.partnerEmail ? "SET" : "MISSING",
      partnerEmail2: envInput.partnerEmail2 ? "SET" : "MISSING",
      partnerReceiverId: envInput.partnerReceiverId ? "SET_UUID" : "MISSING",
      partnerReceiverId2: envInput.partnerReceiverId2 ? "SET_UUID" : "MISSING",
      paymentToken: envInput.paymentToken ? "SET" : "MISSING",
      deviceId: envInput.deviceId ? "SET" : "MISSING",
    },
    hints: preflight.hints,
    cardBrick: {
      status: "HUMAN_BROWSER_STEP_REQUIRED",
      note: "See docs/payments/mp-split-1n-sandbox-evidence.md § Card Brick Evidence",
    },
  };
  writeJson(reportDir, "00-preflight.json", preflightReport);
  console.log(JSON.stringify({ ok: true, phase: "preflight", ...preflightReport }, null, 2));

  if (args.mode === "preflight") {
    process.exitCode = preflight.status === "READY" ? 0 : 2;
    return;
  }

  if (preflight.status !== "READY") {
    console.error(JSON.stringify({ ok: false, abort: "PREFLIGHT_NOT_READY", status: preflight.status }));
    process.exitCode = 3;
    return;
  }
  if (!args.confirmStaging || !args.confirmOrdersTest) {
    console.error(JSON.stringify({ ok: false, abort: "CONFIRMATION_REQUIRED" }));
    process.exitCode = 2;
    return;
  }
  if (!envInput.accessToken || !envInput.ownerUserId || !envInput.partnerReceiverId) {
    console.error(JSON.stringify({ ok: false, abort: "MISSING_CRITICAL_CREDS" }));
    process.exitCode = 3;
    return;
  }
  if (!envInput.paymentToken || !envInput.deviceId) {
    console.error(JSON.stringify({ ok: false, abort: "MISSING_PAYMENT_TOKEN_OR_DEVICE" }));
    process.exitCode = 4;
    return;
  }

  const config = createMercadoPagoProviderConfig({
    accessToken: envInput.accessToken,
    environment: "sandbox",
    ...(envInput.publicKey ? { publicKey: envInput.publicKey } : {}),
  });
  const http = new MercadoPagoHttpClient(config);
  const consentAdapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });
  const ordersAdapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: envInput.ownerUserId,
    httpClient: http,
    verifyAfterCreate: true,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: "DNX TEST",
  });

  // --- Consent real ---
  const consent1 = await evidenceConsent(
    consentAdapter,
    envInput.partnerReceiverId,
    "partner_A",
  );
  let consent2: Awaited<ReturnType<typeof evidenceConsent>> | null = null;
  if (envInput.partnerReceiverId2) {
    consent2 = await evidenceConsent(
      consentAdapter,
      envInput.partnerReceiverId2,
      "partner_B",
    );
  }
  writeJson(reportDir, "01-consents.json", { consent1, consent2 });
  console.log(JSON.stringify({ phase: "consent", consent1, consent2 }, null, 2));

  if (consent1.status !== "ACTIVE") {
    console.error(JSON.stringify({ ok: false, abort: "PARTNER_A_CONSENT_NOT_ACTIVE", consent1 }));
    process.exitCode = 5;
    return;
  }

  const evidenceA: PartnerConsentEvidence = {
    receiverId: envInput.partnerReceiverId,
    status: "ACTIVE",
    provider: "mercadopago",
    // Real remote — NOT testFixture
  };
  const partners1 = [
    { recipientId: "partner_a", receiverId: envInput.partnerReceiverId, evidence: evidenceA },
  ];

  const runId = randomUUID().slice(0, 8);
  const results: Record<string, unknown> = {
    runId,
    startedAt: new Date().toISOString(),
  };

  // --- Order owner + 1 ---
  let order1: Awaited<ReturnType<typeof createOrderSmoke>> | null = null;
  try {
    const minted1 = await mintFreshPaymentToken(envInput.publicKey);
    const token1 = minted1?.token ?? envInput.paymentToken;
    const method1 = minted1?.paymentMethodId ?? "master";
    if (!minted1) {
      console.log(
        JSON.stringify({
          phase: "mint_token",
          label: "owner_plus_1",
          status: "FALLBACK_ENV_TOKEN",
          hint: "Set MERCADOPAGO_TEST_CARD_* for single-use mint (official TEST cards only)",
        }),
      );
    }
    order1 = await createOrderSmoke({
      adapter: ordersAdapter,
      ownerUserId: envInput.ownerUserId,
      partners: partners1,
      totalMinor: 10_000n,
      paymentToken: token1,
      paymentMethodId: method1,
      deviceSessionId: envInput.deviceId,
      externalReference: `imp05-o1-${runId}`,
      idempotencyKey: randomUUID(),
      label: "owner_plus_1",
    });
    writeJson(reportDir, "02-order-owner-plus-1.json", {
      ...order1,
      providerOrderId: undefined,
      primaryPaymentId: undefined,
    });
    console.log(
      JSON.stringify(
        {
          phase: "order_owner_plus_1",
          ...order1,
          providerOrderId: undefined,
          primaryPaymentId: undefined,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 240) : "unknown";
    writeJson(reportDir, "02-order-owner-plus-1-error.json", { error: message });
    console.error(JSON.stringify({ phase: "order_owner_plus_1", ok: false, error: message }));
    results.order1Error = message;
  }

  // --- Order owner + 2 (multi-partner) ---
  let orderN: Awaited<ReturnType<typeof createOrderSmoke>> | null = null;
  if (envInput.partnerReceiverId2 && consent2?.status === "ACTIVE") {
    const evidenceB: PartnerConsentEvidence = {
      receiverId: envInput.partnerReceiverId2,
      status: "ACTIVE",
      provider: "mercadopago",
    };
    try {
      const mintedN = await mintFreshPaymentToken(envInput.publicKey);
      const tokenN = mintedN?.token ?? envInput.paymentToken;
      const methodN = mintedN?.paymentMethodId ?? "master";
      orderN = await createOrderSmoke({
        adapter: ordersAdapter,
        ownerUserId: envInput.ownerUserId,
        partners: [
          ...partners1,
          {
            recipientId: "partner_b",
            receiverId: envInput.partnerReceiverId2,
            evidence: evidenceB,
          },
        ],
        totalMinor: 15_000n,
        paymentToken: tokenN,
        paymentMethodId: methodN,
        deviceSessionId: envInput.deviceId,
        externalReference: `imp05-on-${runId}`,
        idempotencyKey: randomUUID(),
        label: "owner_plus_2",
      });
      writeJson(reportDir, "03-order-owner-plus-n.json", {
        ...orderN,
        providerOrderId: undefined,
        primaryPaymentId: undefined,
      });
      console.log(
        JSON.stringify(
          {
            phase: "order_owner_plus_n",
            ...orderN,
            providerOrderId: undefined,
            primaryPaymentId: undefined,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 240) : "unknown";
      writeJson(reportDir, "03-order-owner-plus-n-error.json", { error: message });
      console.error(JSON.stringify({ phase: "order_owner_plus_n", ok: false, error: message }));
      results.orderNError = message;
    }
  } else {
    writeJson(reportDir, "03-order-owner-plus-n-skipped.json", {
      reason: "partner_B_consent_not_active_or_missing",
      consent2,
    });
  }

  // Prefer multi-partner order for refunds (sandbox has accepted these more reliably)
  const refundTarget = [orderN, order1].find(
    (o) =>
      o &&
      o.providerOrderId &&
      o.primaryPaymentId &&
      (o.getStatus === "PROCESSED_ACCREDITED" ||
        o.getStatus === "PROCESSED" ||
        o.status === "PROCESSED_ACCREDITED" ||
        o.status === "PROCESSED"),
  );

  if (!args.confirmRefundSmoke) {
    writeJson(reportDir, "04-refunds-skipped.json", {
      reason: "DNX_CONFIRM_REFUND_SMOKE / --confirm-refund-smoke missing",
    });
  } else if (!refundTarget) {
    writeJson(reportDir, "04-refunds-blocked.json", {
      reason: "no_accredited_order_with_payment_transaction",
      order1Status: order1?.getStatus ?? order1?.status ?? null,
      orderNStatus: orderN?.getStatus ?? orderN?.status ?? null,
      hint: "Payment token may be single-use/expired — regenerate via Card Brick / mint token",
    });
    console.error(
      JSON.stringify({
        phase: "refunds",
        ok: false,
        reason: "no_accredited_order",
      }),
    );
  } else {
    try {
      await new Promise((r) => setTimeout(r, 10_000));

      const store = new InMemoryRefundStore();
      const ledger = new AppendOnlyLedger();
      const refundSvc = createOrders1nRefundService({
        store,
        provider: ordersAdapter,
        ledger,
        resolveOrderStatus: async () => "PAID",
      });

      // Refresh payment transaction id from GET (avoid stale mapping)
      const fresh = await ordersAdapter.getOrder(
        refundTarget.providerOrderId,
        "sandbox",
      );
      const payTxId =
        fresh.payments[0]?.providerPaymentId ?? refundTarget.primaryPaymentId;
      if (!payTxId) {
        throw new Error("MISSING_PAYMENT_TRANSACTION_ID_AFTER_GET");
      }

      const orderTotal = BigInt(refundTarget.totalMinor);
      const partialAmount = 1_000n;
      const paymentOrderId = `local_${refundTarget.label}_${runId}`;
      const partnerCount = refundTarget.partnerCount;
      const shareCount = BigInt(1 + partnerCount);
      const baseShare = orderTotal / shareCount;
      const originalAllocations = [
        {
          recipientId: "owner",
          role: "OWNER" as const,
          amountMinor: orderTotal - baseShare * BigInt(partnerCount),
        },
        ...Array.from({ length: partnerCount }, (_, i) => ({
          recipientId: `partner_${String.fromCharCode(97 + i)}`,
          role: "PARTNER" as const,
          amountMinor: baseShare,
        })),
      ];

      const idemPartial = randomUUID();
      const adapterPartial = await ordersAdapter.refund({
        providerOrderId: refundTarget.providerOrderId,
        amount: money("ARS", partialAmount),
        providerTransactionId: payTxId,
        idempotencyKey: idemPartial,
      });

      const { allocations: partialAllocations } = allocateRefundProportionally({
        refundAmountMinor: partialAmount,
        originalAllocations,
      });
      const now = new Date().toISOString();
      const partialRecord: PersistedRefundRecord = {
        id: `dnx_rf_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        paymentOrderId,
        providerOrderId: refundTarget.providerOrderId,
        providerRefundId: adapterPartial.providerRefundId,
        providerRefundIds: adapterPartial.providerRefundIds ?? [
          adapterPartial.providerRefundId,
        ],
        amountMinor: partialAmount,
        currency: "ARS",
        status: "PROCESSED",
        statusDetail: adapterPartial.statusDetail ?? "processed",
        idempotencyKey: idemPartial,
        payloadHash: `imp05-${idemPartial}`,
        reason: "partial_adjustment",
        allocations: partialAllocations,
        environment: "sandbox",
        createdAt: now,
        updatedAt: now,
      };
      await store.save(partialRecord);
      postRefundLedgerEntries({
        ledger,
        refundId: partialRecord.id,
        paymentOrderId,
        currency: "ARS",
        refundAmountMinor: partialAmount,
        allocations: partialAllocations,
      });

      const retryAdapter = await ordersAdapter.refund({
        providerOrderId: refundTarget.providerOrderId,
        amount: money("ARS", partialAmount),
        providerTransactionId: payTxId,
        idempotencyKey: idemPartial,
      });
      const localAfterRetry = await store.listByPaymentOrderId(paymentOrderId);

      await new Promise((r) => setTimeout(r, 8_000));

      const remainingAmount = orderTotal - partialAmount;
      const remainingIdem = randomUUID();
      // Remaining via empty-body total refund after partial (MP Orders)
      const adapterRemaining = await ordersAdapter.refund({
        providerOrderId: refundTarget.providerOrderId,
        idempotencyKey: remainingIdem,
      });

      const { allocations: remainingAllocations } = allocateRefundProportionally({
        refundAmountMinor: remainingAmount,
        originalAllocations,
      });
      const remainingRecord: PersistedRefundRecord = {
        id: `dnx_rf_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        paymentOrderId,
        providerOrderId: refundTarget.providerOrderId,
        providerRefundId: adapterRemaining.providerRefundId,
        providerRefundIds: adapterRemaining.providerRefundIds ?? [
          adapterRemaining.providerRefundId,
        ],
        amountMinor: remainingAmount,
        currency: "ARS",
        status: "PROCESSED",
        statusDetail: adapterRemaining.statusDetail ?? "processed",
        idempotencyKey: remainingIdem,
        payloadHash: `imp05-${remainingIdem}`,
        reason: "admin_correction",
        allocations: remainingAllocations,
        environment: "sandbox",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await store.save(remainingRecord);
      postRefundLedgerEntries({
        ledger,
        refundId: remainingRecord.id,
        paymentOrderId,
        currency: "ARS",
        refundAmountMinor: remainingAmount,
        allocations: remainingAllocations,
      });

      const bal = await refundSvc.getRefundableAmount(paymentOrderId, orderTotal, "ARS");
      const recon = await reconcileMercadoPagoOrderRefunds({
        providerOrderId: refundTarget.providerOrderId,
        paymentOrderId,
        orderTotalMinor: orderTotal,
        currency: "ARS",
        environment: "sandbox",
        provider: ordersAdapter,
        store,
      });

      const refundReport = {
        targetOrderPrefix: refundTarget.providerOrderIdPrefix,
        targetLabel: refundTarget.label,
        partnerCount: refundTarget.partnerCount,
        path: "adapter_http_plus_local_ledger",
        partial: {
          amountMinor: partialAmount.toString(),
          status: "PROCESSED",
          allocationSum: partialAllocations
            .reduce((s, a) => s + a.amountMinor, 0n)
            .toString(),
          providerRefundIdPrefix: prefix(adapterPartial.providerRefundId, 12),
          orderStatus: adapterPartial.orderStatus ?? null,
          statusDetail: adapterPartial.statusDetail ?? null,
        },
        idempotentRetry: {
          sameProviderRefundId:
            retryAdapter.providerRefundId === adapterPartial.providerRefundId,
          localRecordCount: localAfterRetry.length,
          retryOrderStatus: retryAdapter.orderStatus ?? null,
        },
        remaining: {
          amountMinor: remainingAmount.toString(),
          status: "PROCESSED",
          providerRefundIdPrefix: prefix(adapterRemaining.providerRefundId, 12),
          orderStatus: adapterRemaining.orderStatus ?? null,
          statusDetail: adapterRemaining.statusDetail ?? null,
          mode: "empty_body_total_remaining",
        },
        balanceAfter: {
          remainingMinor: bal.remainingMinor.toString(),
          fullyRefunded: bal.fullyRefunded,
        },
        reconciliation: {
          providerStatus: recon.providerStatus,
          statusDetail: recon.statusDetail,
          localRefundCount: recon.localRefundCount,
          fullyRefunded: recon.fullyRefunded,
          needsAttention: recon.needsAttention,
          notes: recon.notes,
        },
        ledgerEntryCount: ledger.list().length,
        mpReceiverBreakdownObserved: false,
        allocationStrategy: "PROPORTIONAL_TO_ORIGINAL_SPLITS_LARGEST_REMAINDER",
      };
      writeJson(reportDir, "04-refunds.json", refundReport);
      console.log(JSON.stringify({ phase: "refunds", ...refundReport }, null, 2));
      results.refunds = refundReport;

      if (refundTarget.label === "owner_plus_2") {
        writeJson(reportDir, "05-multipartner-refund.json", {
          coveredBy: "04-refunds.json",
          partnerCount: refundTarget.partnerCount,
          note: "Full refund flow executed on multi-partner order",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 280) : "unknown";
      const statusCode =
        err instanceof Error && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : null;
      writeJson(reportDir, "04-refunds-error.json", {
        error: message,
        statusCode,
        classification: /refund_amount_exceeds|available amount/i.test(message)
          ? "PROVIDER_BEHAVIOR_REFUND_AMOUNT_EXCEEDS"
          : /too_many_requests|movement limit|post processing rejected/i.test(message)
            ? "PROVIDER_SANDBOX_LIMIT_OR_EVENTUAL_CONSISTENCY"
            : "UNKNOWN",
      });
      console.error(
        JSON.stringify({
          phase: "refunds",
          ok: false,
          error: message,
          statusCode,
        }),
      );
      results.refundsError = message;
    }
  }

  const summary = {
    stage: "IMP05",
    finishedAt: new Date().toISOString(),
    productionWritesAllowed: false,
    consentActive: consent1.status === "ACTIVE",
    consentPartnerB: consent2?.status ?? null,
    orderOwnerPlus1: order1
      ? {
          status: order1.getStatus,
          statusDetail: order1.getStatusDetail,
          accredited:
            order1.getStatus === "PROCESSED_ACCREDITED" ||
            order1.status === "PROCESSED_ACCREDITED",
        }
      : null,
    orderOwnerPlusN: orderN
      ? {
          status: orderN.getStatus,
          partnerCount: orderN.partnerCount,
          accredited:
            orderN.getStatus === "PROCESSED_ACCREDITED" ||
            orderN.status === "PROCESSED_ACCREDITED",
        }
      : null,
    refunds: results.refunds ?? null,
    cardBrick: "HUMAN_BROWSER_STEP_REQUIRED",
    reportDir,
  };
  writeJson(reportDir, "99-summary.json", summary);
  console.log(JSON.stringify({ ok: true, phase: "summary", ...summary }, null, 2));
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      fatal: err instanceof Error ? err.message.slice(0, 300) : "unknown",
    }),
  );
  process.exitCode = 1;
});
