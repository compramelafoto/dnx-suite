#!/usr/bin/env node
/**
 * IMPLEMENTACIÓN 06 — Controlled sandbox refund smokes (separate Orders).
 *
 * CASO A: new accredited order → ONE partial → GET → reconcile
 * CASO B: new accredited order → ONE total (empty body) → GET → reconcile
 * IDEMPOTENCY: retry CASO A key once after success
 *
 * Usage:
 *   pnpm --filter @repo/payments exec tsx src/cli/imp06-controlled-refunds.ts \
 *     --case=A --confirm-staging --confirm-orders-test --confirm-refund-smoke
 *   pnpm --filter @repo/payments exec tsx src/cli/imp06-controlled-refunds.ts \
 *     --case=B --confirm-staging --confirm-orders-test --confirm-refund-smoke
 *   pnpm --filter @repo/payments exec tsx src/cli/imp06-controlled-refunds.ts \
 *     --case=idempotency --confirm-staging --confirm-orders-test --confirm-refund-smoke
 *
 * Never prints secrets / PAN / tokens.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MP_API_BASE_URL,
  singleIntangibleItem,
} from "../providers/mercado-pago/index.js";
import { money } from "../money/index.js";
import { calculateDistribution } from "../distribution/index.js";
import {
  allocateRefundProportionally,
  InMemoryRefundStore,
  postRefundLedgerEntries,
  reconcileMercadoPagoOrderRefunds,
} from "../application/services/orders-1n-refunds/index.js";
import { AppendOnlyLedger } from "../ledger/index.js";
import type { PersistedRefundRecord } from "../application/services/orders-1n-refunds/types.js";

type CaseName = "A" | "B" | "idempotency" | "multi";

function parseCase(argv: string[]): CaseName {
  const raw = argv.find((a) => a.startsWith("--case="))?.slice("--case=".length);
  if (raw === "A" || raw === "B" || raw === "idempotency" || raw === "multi") {
    return raw;
  }
  throw new Error("Usage: --case=A|B|idempotency|multi");
}

function confirmed(argv: string[]): boolean {
  return (
    argv.includes("--confirm-staging") &&
    argv.includes("--confirm-orders-test") &&
    argv.includes("--confirm-refund-smoke")
  );
}

function prefix(v: string | null | undefined, n = 12): string | null {
  if (!v) return null;
  return v.length <= n ? `${v.slice(0, 2)}…` : `${v.slice(0, n)}…`;
}

async function mint(publicKey: string): Promise<{ token: string; method: string }> {
  const cardNumber = process.env.MERCADOPAGO_TEST_CARD_NUMBER?.replace(/\s+/g, "") ?? "";
  const expMonth = process.env.MERCADOPAGO_TEST_CARD_EXP_MONTH?.trim() ?? "";
  const expYear = process.env.MERCADOPAGO_TEST_CARD_EXP_YEAR?.trim() ?? "";
  const securityCode = process.env.MERCADOPAGO_TEST_CARD_SECURITY_CODE?.trim() ?? "";
  if (!cardNumber || !expMonth || !expYear || !securityCode) {
    throw new Error("CARD_ENV_MISSING: set MERCADOPAGO_TEST_CARD_* (official TEST only)");
  }
  const method =
    process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() ||
    (cardNumber.startsWith("5031") ? "master" : "visa");
  const url = new URL(`${MP_API_BASE_URL}/v1/card_tokens`);
  url.searchParams.set("public_key", publicKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: cardNumber,
      expiration_month: Number(expMonth),
      expiration_year: Number(expYear),
      security_code: securityCode,
      cardholder: {
        name: process.env.MERCADOPAGO_TEST_CARDHOLDER_NAME?.trim() || "APRO",
        identification: { type: "DNI", number: "12345678" },
      },
    }),
  });
  const j = (await res.json()) as { id?: string };
  if (!j.id) throw new Error(`TOKEN_MINT_FAILED:${res.status}`);
  return { token: j.id, method };
}

async function createAccreditedOrder(input: {
  adapter: MercadoPagoOrdersAdapter;
  env: ReturnType<typeof loadSandboxEnvFromProcess>;
  partners: 1 | 2;
  totalMinor: bigint;
  label: string;
}) {
  const minted = await mint(input.env.publicKey!);
  const total = money("ARS", input.totalMinor);
  const ids =
    input.partners === 2
      ? ["owner", "partner_a", "partner_b"]
      : ["owner", "partner_a"];
  const equal = Math.floor(10_000 / ids.length);
  const rules = ids.map((recipientId, i) => ({
    recipientId,
    role: "OTHER" as const,
    kind: "PERCENTAGE" as const,
    percentageBps: i === 0 ? 10_000 - equal * (ids.length - 1) : equal,
    priority: i + 1,
    optional: false,
  }));
  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: ids,
  });

  const partnerReceiverIds = new Map<string, string>([
    ["partner_a", input.env.partnerReceiverId!],
  ]);
  if (input.partners === 2 && input.env.partnerReceiverId2) {
    partnerReceiverIds.set("partner_b", input.env.partnerReceiverId2);
  }
  const partnerConsentsByRecipientId = new Map(
    [...partnerReceiverIds.entries()].map(([recipientId, receiverId]) => [
      recipientId,
      {
        receiverId,
        status: "ACTIVE" as const,
        provider: "mercadopago" as const,
      },
    ]),
  );

  const created = await input.adapter.createSplitOrder({
    environment: "sandbox",
    externalReference: `imp06-${input.label}-${randomUUID().slice(0, 8)}`,
    total,
    distribution,
    idempotencyKey: randomUUID(),
    deviceSessionId: input.env.deviceId!,
    paymentToken: minted.token,
    paymentMethodId: minted.method,
    installments: 1,
    payerEmail: "buyer.imp06@testuser.com",
    statementDescriptor: "DNX TEST",
    items: [
      singleIntangibleItem({
        title: "Imp06 controlled refund",
        total,
        categoryId: "others",
      }),
    ],
    partnerReceiverIds,
    partnerConsentsByRecipientId,
  });
  const got = await input.adapter.getOrder(created.providerOrderId, "sandbox");
  return {
    providerOrderId: created.providerOrderId,
    status: got.status,
    statusDetail: got.statusDetail ?? null,
    payTxId: got.payments[0]?.providerPaymentId ?? null,
    partnerCount: input.partners,
    totalMinor: input.totalMinor,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const caseName = parseCase(argv);
  if (!confirmed(argv)) {
    console.log(
      JSON.stringify({
        ok: false,
        abort: "CONFIRMATION_REQUIRED",
        need: [
          "--confirm-staging",
          "--confirm-orders-test",
          "--confirm-refund-smoke",
        ],
      }),
    );
    process.exitCode = 2;
    return;
  }

  const prod = (process.env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "")
    .trim()
    .toLowerCase();
  if (prod === "true" || prod === "1" || prod === "yes") {
    console.log(
      JSON.stringify({
        ok: false,
        abort: "PRODUCTION SAFETY BLOCKER",
      }),
    );
    process.exitCode = 99;
    return;
  }

  const env = loadSandboxEnvFromProcess();
  if (
    !env.accessToken ||
    !env.ownerUserId ||
    !env.partnerReceiverId ||
    !env.publicKey ||
    !env.deviceId
  ) {
    console.log(JSON.stringify({ ok: false, abort: "SANDBOX_ENV_INCOMPLETE" }));
    process.exitCode = 3;
    return;
  }

  const config = createMercadoPagoProviderConfig({
    accessToken: env.accessToken,
    environment: "sandbox",
    publicKey: env.publicKey,
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: env.ownerUserId,
    httpClient: http,
    verifyAfterCreate: true,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: "DNX TEST",
  });

  const reportDir = resolve(process.cwd(), "../../.local/audit-imp06");
  mkdirSync(reportDir, { recursive: true });

  const settleMs = Number(process.env.IMP06_REFUND_SETTLE_MS ?? "10000");

  try {
    if (caseName === "A" || caseName === "idempotency") {
      const order = await createAccreditedOrder({
        adapter,
        env,
        partners: 1,
        totalMinor: 10_000n,
        label: "a",
      });
      if (
        order.status !== "PROCESSED_ACCREDITED" ||
        !order.payTxId
      ) {
        throw new Error(`ORDER_NOT_ACCREDITED:${order.status}`);
      }
      await new Promise((r) => setTimeout(r, settleMs));

      const partialAmount = 1_000n;
      const idem = randomUUID();
      const partial = await adapter.refund({
        providerOrderId: order.providerOrderId,
        amount: money("ARS", partialAmount),
        providerTransactionId: order.payTxId,
        idempotencyKey: idem,
      });

      let idempotency: Record<string, unknown> | null = null;
      if (caseName === "idempotency") {
        const retry = await adapter.refund({
          providerOrderId: order.providerOrderId,
          amount: money("ARS", partialAmount),
          providerTransactionId: order.payTxId,
          idempotencyKey: idem,
        });
        idempotency = {
          sameProviderRefundId:
            retry.providerRefundId === partial.providerRefundId,
          retryOrderStatus: retry.orderStatus ?? null,
          retryStatusDetail: retry.statusDetail ?? null,
        };
      }

      const after = await adapter.getOrder(order.providerOrderId, "sandbox");
      const store = new InMemoryRefundStore();
      const ledger = new AppendOnlyLedger();
      const paymentOrderId = `local_imp06_a_${randomUUID().slice(0, 8)}`;
      const originalAllocations = [
        { recipientId: "owner", role: "OWNER" as const, amountMinor: 5_000n },
        {
          recipientId: "partner_a",
          role: "PARTNER" as const,
          amountMinor: 5_000n,
        },
      ];
      const { allocations } = allocateRefundProportionally({
        refundAmountMinor: partialAmount,
        originalAllocations,
      });
      const now = new Date().toISOString();
      const record: PersistedRefundRecord = {
        id: `dnx_rf_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        paymentOrderId,
        providerOrderId: order.providerOrderId,
        providerRefundId: partial.providerRefundId,
        providerRefundIds: partial.providerRefundIds ?? [partial.providerRefundId],
        amountMinor: partialAmount,
        currency: "ARS",
        status: "PROCESSED",
        statusDetail: partial.statusDetail ?? "processed",
        idempotencyKey: idem,
        payloadHash: `imp06-${idem}`,
        reason: "partial_adjustment",
        allocations,
        environment: "sandbox",
        createdAt: now,
        updatedAt: now,
      };
      await store.save(record);
      postRefundLedgerEntries({
        ledger,
        refundId: record.id,
        paymentOrderId,
        currency: "ARS",
        refundAmountMinor: partialAmount,
        allocations,
      });
      const recon = await reconcileMercadoPagoOrderRefunds({
        providerOrderId: order.providerOrderId,
        paymentOrderId,
        orderTotalMinor: order.totalMinor,
        currency: "ARS",
        environment: "sandbox",
        provider: adapter,
        store,
      });

      const report = {
        case: caseName,
        productionWrites: "BLOCKED",
        orderIdPrefix: prefix(order.providerOrderId),
        createStatus: order.status,
        partial: {
          httpOk: true,
          amountMinor: partialAmount.toString(),
          providerRefundIdPrefix: prefix(partial.providerRefundId),
          orderStatus: partial.orderStatus ?? null,
          statusDetail: partial.statusDetail ?? null,
        },
        idempotency,
        getAfter: {
          status: after.status,
          statusDetail: after.statusDetail ?? null,
        },
        reconcile: {
          providerStatus: recon.providerStatus,
          localRefundCount: recon.localRefundCount,
          needsAttention: recon.needsAttention,
        },
        ledgerEntryCount: ledger.list().length,
        mpReceiverBreakdownObserved: false,
      };
      const path = resolve(reportDir, `case-${caseName}.json`);
      writeFileSync(path, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ ok: true, ...report, wrote: path }, null, 2));
      return;
    }

    if (caseName === "B") {
      const order = await createAccreditedOrder({
        adapter,
        env,
        partners: 1,
        totalMinor: 8_000n,
        label: "b",
      });
      if (order.status !== "PROCESSED_ACCREDITED" || !order.payTxId) {
        throw new Error(`ORDER_NOT_ACCREDITED:${order.status}`);
      }
      await new Promise((r) => setTimeout(r, settleMs));

      const totalRefund = await adapter.refund({
        providerOrderId: order.providerOrderId,
        idempotencyKey: randomUUID(),
      });
      const after = await adapter.getOrder(order.providerOrderId, "sandbox");
      const store = new InMemoryRefundStore();
      const paymentOrderId = `local_imp06_b_${randomUUID().slice(0, 8)}`;
      const { allocations } = allocateRefundProportionally({
        refundAmountMinor: order.totalMinor,
        originalAllocations: [
          { recipientId: "owner", role: "OWNER", amountMinor: 4_000n },
          { recipientId: "partner_a", role: "PARTNER", amountMinor: 4_000n },
        ],
      });
      const now = new Date().toISOString();
      await store.save({
        id: `dnx_rf_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        paymentOrderId,
        providerOrderId: order.providerOrderId,
        providerRefundId: totalRefund.providerRefundId,
        providerRefundIds: totalRefund.providerRefundIds ?? [
          totalRefund.providerRefundId,
        ],
        amountMinor: order.totalMinor,
        currency: "ARS",
        status: "PROCESSED",
        statusDetail: totalRefund.statusDetail ?? "processed",
        idempotencyKey: randomUUID(),
        payloadHash: `imp06-b-${randomUUID()}`,
        reason: "admin_correction",
        allocations,
        environment: "sandbox",
        createdAt: now,
        updatedAt: now,
      });
      const recon = await reconcileMercadoPagoOrderRefunds({
        providerOrderId: order.providerOrderId,
        paymentOrderId,
        orderTotalMinor: order.totalMinor,
        currency: "ARS",
        environment: "sandbox",
        provider: adapter,
        store,
      });
      const report = {
        case: "B",
        productionWrites: "BLOCKED",
        orderIdPrefix: prefix(order.providerOrderId),
        createStatus: order.status,
        totalRefund: {
          httpOk: true,
          mode: "empty_body",
          providerRefundIdPrefix: prefix(totalRefund.providerRefundId),
          orderStatus: totalRefund.orderStatus ?? null,
          statusDetail: totalRefund.statusDetail ?? null,
        },
        getAfter: {
          status: after.status,
          statusDetail: after.statusDetail ?? null,
        },
        reconcile: {
          providerStatus: recon.providerStatus,
          localRefundCount: recon.localRefundCount,
          fullyRefunded: recon.fullyRefunded,
          needsAttention: recon.needsAttention,
        },
      };
      const path = resolve(reportDir, "case-B.json");
      writeFileSync(path, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ ok: true, ...report, wrote: path }, null, 2));
      return;
    }

    // multi — one clean partial on owner+2
    if (!env.partnerReceiverId2) {
      throw new Error("PARTNER_B_MISSING");
    }
    const order = await createAccreditedOrder({
      adapter,
      env,
      partners: 2,
      totalMinor: 15_000n,
      label: "multi",
    });
    if (order.status !== "PROCESSED_ACCREDITED" || !order.payTxId) {
      throw new Error(`ORDER_NOT_ACCREDITED:${order.status}`);
    }
    await new Promise((r) => setTimeout(r, settleMs));
    const partial = await adapter.refund({
      providerOrderId: order.providerOrderId,
      amount: money("ARS", 1_000n),
      providerTransactionId: order.payTxId,
      idempotencyKey: randomUUID(),
    });
    const after = await adapter.getOrder(order.providerOrderId, "sandbox");
    const report = {
      case: "multi",
      productionWrites: "BLOCKED",
      partnerCount: 2,
      orderIdPrefix: prefix(order.providerOrderId),
      createStatus: order.status,
      partial: {
        providerRefundIdPrefix: prefix(partial.providerRefundId),
        orderStatus: partial.orderStatus ?? null,
        statusDetail: partial.statusDetail ?? null,
        rawKeys: Object.keys(partial.rawSanitized ?? {}),
      },
      getAfter: {
        status: after.status,
        statusDetail: after.statusDetail ?? null,
      },
      PROVIDER_FACT: "MP response has no per-receiver refund breakdown observed",
      DNX_INTERNAL_ACCOUNTING:
        "PROPORTIONAL_TO_ORIGINAL_SPLITS_LARGEST_REMAINDER",
    };
    const path = resolve(reportDir, "case-multi.json");
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: true, ...report, wrote: path }, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 280) : "unknown";
    const statusCode =
      err instanceof Error && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : null;
    const fail = {
      ok: false,
      case: caseName,
      error: message,
      statusCode,
      classification: /too_many_requests|movement limit|post processing|refund_amount_exceeds/i.test(
        message,
      )
        ? "PROVIDER_SANDBOX_LIMIT_OR_BEHAVIOR"
        : "UNKNOWN",
    };
    writeFileSync(
      resolve(reportDir, `case-${caseName}-error.json`),
      JSON.stringify(fail, null, 2),
    );
    console.error(JSON.stringify(fail));
    process.exitCode = 1;
  }
}

main();
