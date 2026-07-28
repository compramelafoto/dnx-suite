import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateByBasisPoints,
  planEditionCheckoutFromSnapshot,
  reconcileAllocationsWithConfirmedFee,
  validateEditionCheckoutSnapshot,
  EditionCheckoutAllocationError,
  EDITION_CHECKOUT_BPS_TOTAL,
  type EditionCheckoutFinanceSnapshot,
} from "./index.js";
import { extractProviderFeeMinorFromMpPayment } from "./mp-fee.js";

function snap(
  overrides: Partial<EditionCheckoutFinanceSnapshot> & {
    allocations?: EditionCheckoutFinanceSnapshot["allocations"];
  } = {},
): EditionCheckoutFinanceSnapshot {
  const charged = overrides.chargedAmount ?? 2_500_000;
  const providerFeeEstimated = overrides.providerFeeEstimated ?? 0;
  const platformFee = overrides.platformFee ?? 0;
  const distributable = charged - providerFeeEstimated - platformFee;
  const allocations = overrides.allocations ?? [
    {
      beneficiaryUserId: 30,
      beneficiaryDisplayName: "Tammy",
      paymentAccountId: "acc_tammy",
      paymentProvider: "MERCADO_PAGO",
      accountEnvironment: "TEST",
      role: "ORGANIZER",
      shareType: "PERCENTAGE" as const,
      shareValue: 100,
      basisPoints: 10_000,
      allocationAmount: distributable,
      roundingAdjustment: 0,
    },
  ];
  return {
    schemaVersion: 2,
    agreementId: "agr_1",
    distributionVersionId: "ver_1",
    distributionVersionNumber: 1,
    currency: "ARS",
    grossAmount: overrides.grossAmount ?? charged,
    discountAmount: overrides.discountAmount ?? 0,
    chargedAmount: charged,
    providerFeeEstimated,
    platformFee,
    distributableAmount: overrides.distributableAmount ?? distributable,
    feePolicy: { distributableBase: "AFTER_PROVIDER_FEE", platformFeeAmount: 0 },
    roundingPolicy: "LARGEST_REMAINDER",
    createdAt: "2026-07-28T00:00:00.000Z",
    ...overrides,
    allocations,
  };
}

describe("edition-checkout allocate-bps", () => {
  it("Tammy 10000 bps over 2500000", () => {
    const rows = allocateByBasisPoints(2_500_000, [
      { id: "t", basisPoints: 10_000, sortOrder: 0 },
    ]);
    assert.equal(rows[0]!.allocationAmount, 2_500_000);
  });

  it("50/50 even", () => {
    const rows = allocateByBasisPoints(2_500_000, [
      { id: "a", basisPoints: 5_000, sortOrder: 0 },
      { id: "b", basisPoints: 5_000, sortOrder: 1 },
    ]);
    assert.equal(rows[0]!.allocationAmount + rows[1]!.allocationAmount, 2_500_000);
    assert.equal(rows[0]!.allocationAmount, 1_250_000);
    assert.equal(rows[1]!.allocationAmount, 1_250_000);
  });

  it("50/50 odd remainder deterministic", () => {
    const rows = allocateByBasisPoints(2_500_001, [
      { id: "a", basisPoints: 5_000, sortOrder: 0 },
      { id: "b", basisPoints: 5_000, sortOrder: 1 },
    ]);
    assert.equal(rows[0]!.allocationAmount + rows[1]!.allocationAmount, 2_500_001);
    assert.equal(Math.abs(rows[0]!.allocationAmount - rows[1]!.allocationAmount), 1);
    assert.equal(rows[0]!.allocationAmount, 1_250_001); // mayor remainder → +1
  });

  it("33.33/33.33/33.34 exact sum", () => {
    const rows = allocateByBasisPoints(100, [
      { id: "a", basisPoints: 3333, sortOrder: 0 },
      { id: "b", basisPoints: 3333, sortOrder: 1 },
      { id: "c", basisPoints: 3334, sortOrder: 2 },
    ]);
    assert.equal(
      rows.reduce((s, r) => s + r.allocationAmount, 0),
      100,
    );
  });

  it("rejects bps != 10000", () => {
    assert.throws(
      () => allocateByBasisPoints(100, [{ id: "a", basisPoints: 9999, sortOrder: 0 }]),
      (e: unknown) => e instanceof EditionCheckoutAllocationError && e.code === "BPS_SUM",
    );
  });
});

describe("edition-checkout snapshot plan", () => {
  it("plans Tammy 100% collector oauth", () => {
    const planned = planEditionCheckoutFromSnapshot(snap(), {
      bridgeMode: "mercado_pago_test",
    });
    assert.equal(planned.modality, "CHECKOUT_PRO_COLLECTOR_OAUTH");
    assert.equal(planned.collectorPaymentAccountId, "acc_tammy");
    assert.equal(planned.allocations[0]!.basisPoints, EDITION_CHECKOUT_BPS_TOTAL);
  });

  it("rejects N>1 on Checkout Pro preferences", () => {
    const distributable = 2_500_000;
    const half = allocateByBasisPoints(distributable, [
      { id: "a", basisPoints: 5_000, sortOrder: 0 },
      { id: "b", basisPoints: 5_000, sortOrder: 1 },
    ]);
    assert.throws(
      () =>
        planEditionCheckoutFromSnapshot(
          snap({
            allocations: [
              {
                beneficiaryUserId: 1,
                beneficiaryDisplayName: "A",
                paymentAccountId: "acc_a",
                paymentProvider: "MERCADO_PAGO",
                accountEnvironment: "TEST",
                role: "OWNER",
                shareType: "PERCENTAGE",
                shareValue: 50,
                basisPoints: 5_000,
                allocationAmount: half[0]!.allocationAmount,
                roundingAdjustment: half[0]!.roundingAdjustment,
              },
              {
                beneficiaryUserId: 2,
                beneficiaryDisplayName: "B",
                paymentAccountId: "acc_b",
                paymentProvider: "MERCADO_PAGO",
                accountEnvironment: "TEST",
                role: "PARTNER",
                shareType: "PERCENTAGE",
                shareValue: 50,
                basisPoints: 5_000,
                allocationAmount: half[1]!.allocationAmount,
                roundingAdjustment: half[1]!.roundingAdjustment,
              },
            ],
          }),
          { bridgeMode: "mercado_pago_test" },
        ),
      (e: unknown) =>
        e instanceof EditionCheckoutAllocationError && e.code === "CHECKOUT_PRO_N1_ONLY",
    );
  });

  it("applies promotion before distributable", () => {
    const s = snap({
      grossAmount: 3_000_000,
      discountAmount: 500_000,
      chargedAmount: 2_500_000,
      providerFeeEstimated: 0,
      platformFee: 0,
      distributableAmount: 2_500_000,
    });
    validateEditionCheckoutSnapshot(s);
    assert.equal(s.chargedAmount, s.grossAmount - s.discountAmount);
  });

  it("subtracts provider fee before allocation", () => {
    const charged = 2_500_000;
    const fee = 125_000;
    const dist = charged - fee;
    const s = snap({
      chargedAmount: charged,
      providerFeeEstimated: fee,
      platformFee: 0,
      distributableAmount: dist,
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
    });
    const planned = planEditionCheckoutFromSnapshot(s, { bridgeMode: "manual" });
    assert.equal(planned.allocations[0]!.allocationAmountEstimated, dist);
  });

  it("reconciles when confirmed fee differs", () => {
    const planned = planEditionCheckoutFromSnapshot(snap({ providerFeeEstimated: 0 }), {
      bridgeMode: "manual",
    });
    const recon = reconcileAllocationsWithConfirmedFee({
      chargedAmount: 2_500_000,
      platformFee: 0,
      providerFeeConfirmed: 100_000,
      planned: planned.allocations,
    });
    assert.equal(recon.distributableAmountConfirmed, 2_400_000);
    assert.equal(recon.allocations[0]!.allocationAmountConfirmed, 2_400_000);
  });

  it("extracts fee_details from MP payment", () => {
    const fee = extractProviderFeeMinorFromMpPayment({
      currency_id: "ARS",
      transaction_amount: 25000,
      fee_details: [{ type: "mercadopago_fee", amount: 1250 }],
    });
    assert.equal(fee.source, "fee_details");
    assert.equal(fee.providerFeeConfirmedMinor, 125_000);
  });
});
