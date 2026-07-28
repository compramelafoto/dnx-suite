/**
 * Etapa 6 — allocations 1:N desde snapshot + checkout sin stub owner.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allocateByBasisPoints,
  planEditionCheckoutFromSnapshot,
  EditionCheckoutAllocationError,
  type EditionCheckoutFinanceSnapshot,
} from "@repo/payments/edition-checkout";
import {
  createClickatonCheckoutService,
  createInMemoryDnxPaymentsPersistence,
} from "@repo/payments/next";

function snap(partial: Partial<EditionCheckoutFinanceSnapshot> = {}): EditionCheckoutFinanceSnapshot {
  const charged = partial.chargedAmount ?? 2_500_000;
  const fee = partial.providerFeeEstimated ?? 0;
  const platform = partial.platformFee ?? 0;
  const dist = charged - fee - platform;
  return {
    schemaVersion: 2,
    agreementId: "agr_ar",
    distributionVersionId: "ver_1",
    distributionVersionNumber: 1,
    currency: "ARS",
    grossAmount: charged,
    discountAmount: 0,
    chargedAmount: charged,
    providerFeeEstimated: fee,
    platformFee: platform,
    distributableAmount: dist,
    feePolicy: "AFTER_PROVIDER_FEE",
    roundingPolicy: "LARGEST_REMAINDER",
    allocations: [
      {
        beneficiaryUserId: 30,
        beneficiaryDisplayName: "Tammy",
        paymentAccountId: "acc_tammy",
        paymentProvider: "MERCADO_PAGO",
        accountEnvironment: "TEST",
        role: "ORGANIZER",
        shareType: "PERCENTAGE",
        shareValue: 100,
        basisPoints: 10_000,
        allocationAmount: dist,
        roundingAdjustment: 0,
      },
    ],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

async function main() {
  // Static: no stub path when editionFinance present
  const serviceSrc = readFileSync(
    join(
      process.cwd(),
      "../../packages/payments/src/application/services/clickaton-checkout/clickaton-checkout-service.ts",
    ),
    "utf8",
  );
  assert.match(serviceSrc, /editionFinance/);
  assert.match(serviceSrc, /buildSplitsFromEditionPlan/);
  assert.match(serviceSrc, /edition_finance_snapshot_required/);

  const bridgeSrc = readFileSync(
    join(
      process.cwd(),
      "../../packages/payments/src/providers/mercado-pago/checkout-pro/provider-bridge.ts",
    ),
    "utf8",
  );
  assert.match(bridgeSrc, /edition_finance_collector_token_required/);
  assert.match(bridgeSrc, /collectorAccessToken/);

  // 1–4 snapshot / bps
  assert.throws(
    () => planEditionCheckoutFromSnapshot(snap({ schemaVersion: 1 as never })),
    (e: unknown) => e instanceof EditionCheckoutAllocationError,
  );
  assert.throws(
    () =>
      planEditionCheckoutFromSnapshot(
        snap({
          allocations: [
            {
              beneficiaryUserId: 1,
              beneficiaryDisplayName: "X",
              paymentAccountId: "a",
              paymentProvider: "MERCADO_PAGO",
              accountEnvironment: "TEST",
              role: "OWNER",
              shareType: "PERCENTAGE",
              shareValue: 50,
              basisPoints: 5_000,
              allocationAmount: 1,
              roundingAdjustment: 0,
            },
          ],
          distributableAmount: 1,
        }),
      ),
    (e: unknown) => e instanceof EditionCheckoutAllocationError && e.code === "BPS_SUM",
  );

  const planned = planEditionCheckoutFromSnapshot(snap(), { bridgeMode: "manual" });
  assert.equal(planned.allocations[0]!.basisPoints, 10_000);
  assert.equal(planned.collectorPaymentAccountId, "acc_tammy");

  // Rounding multi-beneficiary
  const three = allocateByBasisPoints(100, [
    { id: "a", basisPoints: 3333, sortOrder: 0 },
    { id: "b", basisPoints: 3333, sortOrder: 1 },
    { id: "c", basisPoints: 3334, sortOrder: 2 },
  ]);
  assert.equal(three.reduce((s, r) => s + r.allocationAmount, 0), 100);

  // Durable checkout with editionFinance (manual) — no stub partner 0
  const db = createInMemoryDnxPaymentsPersistence();
  const service = createClickatonCheckoutService(db);
  const result = await service.createOrder({
    sourceApp: "CLICKATON",
    sourceType: "REGISTRATION",
    sourceId: "reg_ef_1",
    idempotencyKey: "idem_ef_1",
    payloadHash: "hash_ef_1",
    amountMinor: 2_500_000,
    currency: "ARS",
    description: "Inscripción Clickatón TEST · EF",
    successUrl: "http://localhost/ok",
    pendingUrl: "http://localhost/pending",
    failureUrl: "http://localhost/fail",
    editionFinance: { snapshot: snap() },
  });
  assert.equal(result.outcome, "created");
  if (result.outcome !== "created") throw new Error("expected created");

  const order = await db.paymentOrders.findById(result.order.id);
  assert.ok(order);
  const snapMeta = order!.distributionSnapshot as {
    editionFinance?: { allocations?: unknown[]; legacyStubRecipients?: boolean };
    legacyStubRecipients?: boolean;
  };
  assert.ok(snapMeta.editionFinance);
  assert.equal(snapMeta.legacyStubRecipients, undefined);

  const provider = await db.providerOrders.findByPaymentOrderId(result.order.id);
  assert.ok(provider);
  const splits = await db.providerSplits.listByProviderOrderId(provider!.id);
  assert.equal(splits.length, 1);
  assert.equal(Number(splits[0]!.amountMinor), 2_500_000);
  assert.notEqual(splits[0]!.description, "stub-no-split");

  // Idempotent reuse
  const again = await service.createOrder({
    sourceApp: "CLICKATON",
    sourceType: "REGISTRATION",
    sourceId: "reg_ef_1",
    idempotencyKey: "idem_ef_1",
    payloadHash: "hash_ef_1",
    amountMinor: 2_500_000,
    currency: "ARS",
    description: "Inscripción Clickatón TEST · EF",
    successUrl: "http://localhost/ok",
    pendingUrl: "http://localhost/pending",
    failureUrl: "http://localhost/fail",
    editionFinance: { snapshot: snap() },
  });
  assert.equal(again.outcome, "reused");

  // MP mode without finance → fail
  const { createMercadoPagoTestClickatonProviderBridge, createMercadoPagoCheckoutProTestAdapter } =
    await import("@repo/payments/next");
  // Without real token we only assert the service gate before bridge:
  const db2 = createInMemoryDnxPaymentsPersistence();
  const svc2 = createClickatonCheckoutService(db2, {
    providerBridge: {
      mode: "mercado_pago_test",
      providerName: "mercadopago_preferences_legacy",
      async createCheckout() {
        throw new Error("should_not_reach_bridge_without_finance");
      },
    },
  });
  await assert.rejects(
    () =>
      svc2.createOrder({
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: "reg_ef_2",
        idempotencyKey: "idem_ef_2",
        payloadHash: "hash_ef_2",
        amountMinor: 1000,
        currency: "ARS",
        description: "Inscripción Clickatón TEST",
        successUrl: "https://example.com/ok",
        pendingUrl: "https://example.com/p",
        failureUrl: "https://example.com/f",
        notificationUrl: "https://example.com/hook",
      }),
    /edition_finance_snapshot_required/,
  );

  void createMercadoPagoTestClickatonProviderBridge;
  void createMercadoPagoCheckoutProTestAdapter;

  console.log(JSON.stringify({ ok: true, checks: 12 }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
