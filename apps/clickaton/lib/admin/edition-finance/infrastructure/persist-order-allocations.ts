import { prisma } from "@/lib/admin/db";
import type { EditionCheckoutFinanceSnapshot } from "@repo/payments/edition-checkout";
import {
  planEditionCheckoutFromSnapshot,
  reconcileAllocationsWithConfirmedFee,
} from "@repo/payments/edition-checkout";

/**
 * Persistencia idempotente de allocations (settlement projection).
 * Unique: paymentOrderId + beneficiaryUserId + distributionVersionId.
 */
export async function persistOrderAllocationsFromSnapshot(input: {
  paymentOrderId: string;
  snapshot: EditionCheckoutFinanceSnapshot;
  providerReference?: string | null;
  status?: "PENDING" | "CREATED" | "PAID" | "RECONCILED" | "FAILED";
}): Promise<{ created: number; reused: number }> {
  const planned = planEditionCheckoutFromSnapshot(input.snapshot, {
    bridgeMode: "manual",
  });
  let created = 0;
  let reused = 0;

  for (const a of planned.allocations) {
    const idempotencyKey = [
      input.paymentOrderId,
      a.beneficiaryUserId ?? "null",
      input.snapshot.distributionVersionId,
    ].join(":");

    const existing = await prisma.dnxPaymentOrderAllocation.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      reused += 1;
      continue;
    }

    try {
      await prisma.dnxPaymentOrderAllocation.create({
        data: {
          paymentOrderId: input.paymentOrderId,
          agreementId: input.snapshot.agreementId,
          distributionVersionId: input.snapshot.distributionVersionId,
          beneficiaryUserId: a.beneficiaryUserId,
          paymentAccountId: a.paymentAccountId,
          role: a.role,
          basisPoints: a.basisPoints,
          grossAmount: BigInt(input.snapshot.grossAmount),
          discountAmount: BigInt(input.snapshot.discountAmount),
          chargedAmount: BigInt(input.snapshot.chargedAmount),
          providerFeeEstimated: BigInt(input.snapshot.providerFeeEstimated),
          platformFee: BigInt(input.snapshot.platformFee),
          distributableAmountEstimated: BigInt(planned.distributableAmountEstimated),
          allocationAmountEstimated: BigInt(a.allocationAmountEstimated),
          currency: input.snapshot.currency,
          status: input.status ?? "CREATED",
          providerReference: input.providerReference ?? null,
          idempotencyKey,
          roundingAdjustment: a.roundingAdjustment,
          metadata: {
            beneficiaryDisplayName: a.beneficiaryDisplayName,
            accountEnvironment: a.accountEnvironment,
            modality: planned.modality,
          },
        },
      });
      created += 1;
    } catch (err) {
      // Unique race → treat as reused
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Unique") || msg.includes("unique")) {
        reused += 1;
        continue;
      }
      throw err;
    }
  }

  return { created, reused };
}

export async function markOrderAllocationsPaid(paymentOrderId: string): Promise<number> {
  const result = await prisma.dnxPaymentOrderAllocation.updateMany({
    where: {
      paymentOrderId,
      status: { in: ["PENDING", "CREATED"] },
    },
    data: { status: "PAID" },
  });
  return result.count;
}

export async function reconcileOrderAllocationsAfterPayment(input: {
  paymentOrderId: string;
  providerFeeConfirmed: number;
}): Promise<{ ok: true; distributableConfirmed: number } | { ok: false; reason: string }> {
  const rows = await prisma.dnxPaymentOrderAllocation.findMany({
    where: { paymentOrderId: input.paymentOrderId },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    return { ok: false, reason: "no_allocations" };
  }
  // Ya reconciliado: idempotente
  if (rows.every((r) => r.status === "RECONCILED" && r.providerFeeConfirmed != null)) {
    return {
      ok: true,
      distributableConfirmed: Number(rows[0]!.distributableAmountConfirmed ?? 0),
    };
  }

  const charged = Number(rows[0]!.chargedAmount);
  const platformFee = Number(rows[0]!.platformFee);
  const planned = rows.map((r) => ({
    beneficiaryUserId: r.beneficiaryUserId,
    paymentAccountId: r.paymentAccountId ?? "",
    role: r.role,
    basisPoints: r.basisPoints,
    allocationAmountEstimated: Number(r.allocationAmountEstimated),
    roundingAdjustment: r.roundingAdjustment,
    beneficiaryDisplayName: String(
      (r.metadata as { beneficiaryDisplayName?: string } | null)?.beneficiaryDisplayName ??
        "Beneficiario",
    ),
    accountEnvironment: String(
      (r.metadata as { accountEnvironment?: string } | null)?.accountEnvironment ?? "TEST",
    ),
    paymentProvider: "MERCADO_PAGO",
  }));

  const recon = reconcileAllocationsWithConfirmedFee({
    chargedAmount: charged,
    platformFee,
    providerFeeConfirmed: input.providerFeeConfirmed,
    planned,
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const a = recon.allocations[i]!;
    await prisma.dnxPaymentOrderAllocation.update({
      where: { id: row.id },
      data: {
        providerFeeConfirmed: BigInt(input.providerFeeConfirmed),
        distributableAmountConfirmed: BigInt(recon.distributableAmountConfirmed),
        allocationAmountConfirmed: BigInt(a.allocationAmountConfirmed),
        roundingAdjustment: a.roundingAdjustment,
        status: "RECONCILED",
      },
    });
  }

  return { ok: true, distributableConfirmed: recon.distributableAmountConfirmed };
}
