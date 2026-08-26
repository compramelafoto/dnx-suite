/**
 * Fixture seguro / dry-run: verifica que la edición resuelve la distribución
 * PUBLICADA (V1 Owner) para cobros e ignora borradores.
 *
 * Uso (solo lectura + dry-run de plan, sin cobro real):
 *   cd apps/clickaton
 *   npx tsx scripts/verify-published-distribution-checkout.ts --edition-slug=<slug>
 *
 * No imprime tokens. No crea preferencias MP. No muta V1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/admin/db";
import { resolveActiveEditionDistribution } from "../lib/admin/edition-finance/infrastructure/prisma-edition-finance";
import { evaluateCommercialFinanceGate } from "../lib/admin/edition-finance/domain/gate";
import { buildOrderFinanceSnapshot, toEditionCheckoutFinanceSnapshot } from "../lib/admin/edition-finance/domain/snapshot";
import { isClickatonDnxCheckoutEnabled } from "@repo/payments/clickaton-checkout";
import { planEditionCheckoutFromSnapshot } from "@repo/payments/edition-checkout";

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const slugArg = arg("edition-slug");
  const edition = slugArg
    ? await prisma.clickatonEdition.findFirst({
        where: { slug: slugArg },
        select: { id: true, name: true, slug: true, registrationEnabled: true },
      })
    : await prisma.clickatonEdition.findFirst({
        where: {
          OR: [
            { slug: { contains: "primavera", mode: "insensitive" } },
            { name: { contains: "Primavera", mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, slug: true, registrationEnabled: true },
      });

  if (!edition) {
    console.error("NO_EDITION", { editionSlug: slugArg });
    process.exitCode = 2;
    return;
  }

  const agreement = await prisma.dnxEconomicAgreement.findUnique({
    where: {
      productKey_scopeType_scopeId: {
        productKey: "clickaton",
        scopeType: "EDITION",
        scopeId: edition.id,
      },
    },
  });
  const versions = agreement
    ? await prisma.dnxDistributionVersion.findMany({
        where: { agreementId: agreement.id },
        orderBy: { versionNumber: "asc" },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          publishedAt: true,
        },
      })
    : [];

  const active = await resolveActiveEditionDistribution(edition.id);
  const flag = isClickatonDnxCheckoutEnabled(process.env);
  const webhookConfigured = Boolean(
    process.env.CLICKATON_DNX_PAYMENTS_WEBHOOK_SECRET ||
      process.env.DNX_PAYMENTS_WEBHOOK_SECRET,
  );
  const gate = evaluateCommercialFinanceGate({
    mode: process.env.NODE_ENV === "production" ? "LIVE" : "TEST",
    distribution: active,
    dnxPaymentsReady: flag,
    webhookConfigured,
    hasActivePricePhase: true,
  });

  const drafts = versions.filter((v) => v.status === "DRAFT");
  const published = versions.filter((v) => v.status === "PUBLISHED");

  let dryRun: Record<string, unknown> | null = null;
  if (active) {
    const snap = buildOrderFinanceSnapshot({
      distribution: active,
      currency: "ARS",
      // monto mínimo de fixture (centavos) — no se cobra
      grossAmount: 100,
      discountAmount: 0,
      providerFee: 0,
      platformFee: 0,
    });
    const planned = planEditionCheckoutFromSnapshot(
      toEditionCheckoutFinanceSnapshot(snap),
      { bridgeMode: "manual" },
    );
    dryRun = {
      distributionVersionId: snap.distributionVersionId,
      distributionVersionNumber: snap.distributionVersionNumber,
      collectorPaymentAccountId: planned.collectorPaymentAccountId,
      modality: planned.modality,
      allocationPaymentAccountIds: planned.allocations.map((a) => a.paymentAccountId),
      chargedAmount: snap.chargedAmount,
    };
  }

  const report = {
    edition: {
      id: edition.id,
      slug: edition.slug,
      name: edition.name,
      registrationEnabled: edition.registrationEnabled,
    },
    agreement: agreement
      ? {
          id: agreement.id,
          status: agreement.status,
          currentVersionId: agreement.currentVersionId,
        }
      : null,
    versions,
    draftsCount: drafts.length,
    publishedCount: published.length,
    activeResolved: active
      ? {
          versionId: active.versionId,
          versionNumber: active.version,
          versionStatus: active.versionStatus,
          status: active.status,
          sumBps: active.allocations.reduce((s, a) => s + a.shareBps, 0),
          beneficiaries: active.allocations.map((a) => ({
            displayName: a.beneficiaryDisplayName,
            shareBps: a.shareBps,
            paymentAccountId: a.paymentConnectionId,
            accountEnv: a.paymentConnection?.environment ?? null,
            canReceive: a.paymentConnection?.canReceivePayments ?? false,
          })),
        }
      : null,
    env: {
      dnxCheckoutFlag: flag,
      webhookConfigured,
      provider: process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    },
    gate: {
      ok: gate.ok,
      mode: gate.mode,
      blockers: gate.blockers,
      warnings: gate.warnings,
    },
    checkoutDryRunMinAmount: dryRun,
    verdict: {
      usesPublishedOnly: Boolean(active && active.versionStatus === "PUBLISHED"),
      ignoresDraftsForCharges: drafts.every((d) => d.id !== active?.versionId),
      paymentsReadyForCharges: gate.ok,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!active || !gate.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("VERIFY_FAILED", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
