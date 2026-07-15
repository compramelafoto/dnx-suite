#!/usr/bin/env node
/**
 * Staging-only persistence smoke for DNX Payments (no Mercado Pago HTTP).
 *
 * Requires DATABASE_URL/DIRECT_URL pointing at Neon staging (ep-round-fog).
 * Usage:
 *   DATABASE_URL=... DIRECT_URL=... pnpm --filter @repo/payments smoke:persistence-staging -- --confirm
 */

import { PrismaClient } from "@prisma/client";
import { createPrismaDnxPaymentsPersistence } from "../infrastructure/prisma/index.js";
import {
  createIntentUnit,
  registerProviderOrderUnit,
  reserveIdempotencyUnit,
} from "../application/persistence/index.js";

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function assertStagingGate(): { host: string } {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const host = hostOf(directUrl || databaseUrl);
  if (!host.startsWith("ep-round-fog") || !host.includes("neon.tech")) {
    throw new Error(
      `STAGING_GATE_FAILED: expected Neon staging host ep-round-fog*, got prefix=${host.slice(0, 22) || "missing"}`,
    );
  }
  if (host.toLowerCase().includes("prod")) {
    throw new Error("STAGING_GATE_FAILED: host looks like production");
  }
  return { host };
}

function parseArgs(argv: string[]) {
  return {
    confirm: argv.includes("--confirm"),
    cleanup: argv.includes("--cleanup") || !argv.includes("--keep"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const gate = assertStagingGate();
  const correlationId = crypto.randomUUID();
  const now = new Date().toISOString();

  if (!args.confirm) {
    console.log(
      JSON.stringify(
        {
          status: "CONFIRMATION_REQUIRED",
          hostPrefix: gate.host.slice(0, 22),
          message: "Re-run with --confirm to write staging fixtures",
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();
  const db = createPrismaDnxPaymentsPersistence(
    prisma as unknown as import("../infrastructure/prisma/index.js").DnxPaymentsPrismaDelegates,
  );

  const suffix = correlationId.slice(0, 8);
  const ownerId = `smoke-owner-${suffix}`;
  const partnerId = `smoke-partner-${suffix}`;
  const intentId = `smoke-intent-${suffix}`;
  const orderId = `smoke-order-${suffix}`;
  const providerOrderId = `smoke-prov-${suffix}`;
  const idempotencyId = `smoke-idemp-${suffix}`;
  const externalReference = `dnx-payments-stage05:${suffix}`;

  try {
    await db.recipients.save({
      id: ownerId,
      recipientType: "PLATFORM",
      status: "ACTIVE",
      displayReference: "stage05-owner",
      createdAt: now,
      updatedAt: now,
    });
    await db.recipients.save({
      id: partnerId,
      recipientType: "PHOTOGRAPHER",
      status: "ACTIVE",
      displayReference: "stage05-partner",
      createdAt: now,
      updatedAt: now,
    });

    await db.providerAccounts.save({
      id: `smoke-acc-owner-${suffix}`,
      recipientId: ownerId,
      provider: "mercadopago",
      environment: "sandbox",
      providerAccountReference: `owner-test-${suffix}`,
      providerOwnerEligible: true,
      status: "ACTIVE",
      metadataSanitized: { source: "stage05-smoke" },
      createdAt: now,
      updatedAt: now,
    });
    await db.providerAccounts.save({
      id: `smoke-acc-partner-${suffix}`,
      recipientId: partnerId,
      provider: "mercadopago",
      environment: "sandbox",
      providerAccountReference: `partner-test-${suffix}`,
      providerOwnerEligible: false,
      status: "ACTIVE",
      metadataSanitized: { source: "stage05-smoke" },
      createdAt: now,
      updatedAt: now,
    });

    await db.consents.save({
      id: `smoke-consent-${suffix}`,
      provider: "mercadopago",
      environment: "sandbox",
      primaryProviderAccountReference: `owner-test-${suffix}`,
      providerReceiverId: `00000000-0000-4000-8000-${suffix.padEnd(12, "0").slice(0, 12)}`,
      recipientId: partnerId,
      status: "ACTIVE",
      invitationReference: null,
      providerCreatedAt: now,
      providerUpdatedAt: now,
      lastCheckedAt: now,
      source: "SMOKE",
      createdAt: now,
      updatedAt: now,
    });

    await createIntentUnit(db, {
      intent: {
        id: intentId,
        sourceProduct: "dnx",
        externalReference,
        currency: "ARS",
        totalMinor: 1000n,
        status: "READY",
        environment: "sandbox",
        isTestFixture: true,
        distributionSnapshot: { ownerBps: 7000, partnerBps: 3000, source: "stage05" },
        createdAt: now,
        updatedAt: now,
      },
      audit: {
        id: `smoke-aud-intent-${suffix}`,
        actorType: "system",
        action: "stage05.intent.create",
        aggregateType: "payment_intent",
        aggregateId: intentId,
        provider: "mercadopago",
        environment: "sandbox",
        correlationId,
        result: "SUCCEEDED",
        metadata: { source: "stage05-smoke" },
        createdAt: now,
      },
    });

    const idempo = await reserveIdempotencyUnit(db, {
      reserve: {
        id: idempotencyId,
        operation: "create_order",
        provider: "mercadopago",
        environment: "sandbox",
        idempotencyKey: `stage05-${suffix}`,
        payloadHash: `hash-${suffix}`,
        aggregateType: "payment_order",
        aggregateId: orderId,
        now,
      },
      order: {
        id: orderId,
        paymentIntentId: intentId,
        provider: "mercadopago",
        environment: "sandbox",
        status: "AWAITING_PROVIDER",
        amountMinor: 1000n,
        currency: "ARS",
        ownerRecipientId: ownerId,
        isTestFixture: true,
        distributionSnapshot: { ownerMinor: "700", partnerMinor: "300" },
        createdAt: now,
        updatedAt: now,
      },
      audit: {
        id: `smoke-aud-idemp-${suffix}`,
        actorType: "system",
        action: "stage05.idempotency.reserve",
        aggregateType: "payment_order",
        aggregateId: orderId,
        provider: "mercadopago",
        environment: "sandbox",
        correlationId,
        result: "SUCCEEDED",
        createdAt: now,
      },
    });

    // Simulated provider call boundary (no HTTP).
    await registerProviderOrderUnit(db, {
      providerOrder: {
        id: providerOrderId,
        paymentOrderId: orderId,
        provider: "mercadopago",
        environment: "sandbox",
        providerOrderId: `mp-fake-${suffix}`,
        providerStatus: "processed",
        providerStatusDetail: "accredited",
        mappedStatus: "PROCESSED",
        totalMinor: 1000n,
        currency: "ARS",
        rawResponseSanitized: { source: "stage05-smoke", token: "TEST-should-redact" },
        lastFetchedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      splits: [
        {
          id: `smoke-split-owner-${suffix}`,
          providerOrderId,
          recipientId: ownerId,
          providerReceiverReference: `owner-test-${suffix}`,
          receiverType: "OWNER",
          amountMinor: 700n,
          currency: "ARS",
          description: "owner",
          status: "CONFIRMED",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `smoke-split-partner-${suffix}`,
          providerOrderId,
          recipientId: partnerId,
          providerReceiverReference: `partner-test-${suffix}`,
          receiverType: "PARTNER",
          amountMinor: 300n,
          currency: "ARS",
          description: "partner",
          status: "CONFIRMED",
          createdAt: now,
          updatedAt: now,
        },
      ],
      idempotencyId: idempo.id,
      now,
      responseHash: `resp-${suffix}`,
      audit: {
        id: `smoke-aud-prov-${suffix}`,
        actorType: "system",
        action: "stage05.provider_order.register",
        aggregateType: "provider_order",
        aggregateId: providerOrderId,
        provider: "mercadopago",
        environment: "sandbox",
        correlationId,
        result: "SUCCEEDED",
        createdAt: now,
      },
    });

    const loadedIntent = await db.intents.findByExternalReference("dnx", externalReference);
    const loadedOrder = await db.providerOrders.findByProviderOrderId(
      "mercadopago",
      "sandbox",
      `mp-fake-${suffix}`,
    );
    const splits = loadedOrder
      ? await db.providerSplits.listByProviderOrderId(loadedOrder.id)
      : [];
    const audits = await db.audit.list({ correlationId });
    const idemp = await db.idempotency.find("mercadopago", "sandbox", `stage05-${suffix}`);

    const report = {
      status: "PERSISTENCE_SMOKE_OK",
      hostPrefix: gate.host.slice(0, 22),
      correlationIdPrefix: correlationId.slice(0, 8),
      environment: "sandbox",
      httpCallsToMercadoPago: 0,
      checks: {
        intentFound: Boolean(loadedIntent?.isTestFixture),
        providerOrderFound: Boolean(loadedOrder),
        ownerSplits: splits.filter((s) => s.receiverType === "OWNER").length,
        partnerSplits: splits.filter((s) => s.receiverType === "PARTNER").length,
        idempotencySucceeded: idemp?.status === "SUCCEEDED",
        auditCount: audits.length,
        sanitizedToken:
          loadedOrder?.rawResponseSanitized?.token === "[REDACTED]" ||
          loadedOrder?.rawResponseSanitized?.token === undefined,
      },
      cleanup: args.cleanup ? "PENDING" : "SKIPPED",
    };

    if (args.cleanup) {
      // Delete in FK-safe order (audit kept as append evidence with fixture marker in metadata).
      await prisma.dnxProviderSplit.deleteMany({ where: { providerOrderId } });
      await prisma.dnxProviderOrder.deleteMany({ where: { id: providerOrderId } });
      await prisma.dnxPaymentOrder.deleteMany({ where: { id: orderId } });
      await prisma.dnxPaymentIdempotencyRecord.deleteMany({ where: { id: idempotencyId } });
      await prisma.dnxPaymentIntent.deleteMany({ where: { id: intentId } });
      await prisma.dnxSplitConsent.deleteMany({ where: { id: `smoke-consent-${suffix}` } });
      await prisma.dnxProviderRecipientAccount.deleteMany({
        where: { id: { in: [`smoke-acc-owner-${suffix}`, `smoke-acc-partner-${suffix}`] } },
      });
      await prisma.dnxPaymentRecipient.deleteMany({
        where: { id: { in: [ownerId, partnerId] } },
      });
      report.cleanup = "DONE_KEEPING_AUDIT";
    }

    console.log(JSON.stringify(report, null, 2));
    const ok =
      report.checks.intentFound &&
      report.checks.providerOrderFound &&
      report.checks.ownerSplits === 1 &&
      report.checks.partnerSplits === 1 &&
      report.checks.idempotencySucceeded &&
      report.checks.auditCount >= 3;
    process.exitCode = ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown_error";
  console.error(JSON.stringify({ status: "PERSISTENCE_SMOKE_FAILED", error: message }));
  process.exitCode = 1;
});
