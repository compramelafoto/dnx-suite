/**
 * Read-only Production LIVE preflight (10E.4).
 * Usage:
 *   CLICKATON_LIVE_PREFLIGHT=1 DATABASE_URL=… pnpm exec tsx scripts/run-live-preflight-10e4.ts
 * Never creates MP preferences.
 */
import { prisma } from "@repo/db";
import { preflightClickatonLivePayments } from "@repo/payments/next";

async function main() {
  if (process.env.CLICKATON_LIVE_PREFLIGHT !== "1") {
    console.error("Set CLICKATON_LIVE_PREFLIGHT=1");
    process.exit(1);
  }
  try {
    const edition = await prisma.clickatonEdition.findUnique({
      where: { slug: "clickaton-argentina-2026" },
      select: { id: true, registrationEnabled: true, status: true },
    });
    if (!edition) throw new Error("edition missing");

    const now = new Date();
    const phase = await prisma.clickatonRegistrationPricePhase.findFirst({
      where: {
        editionId: edition.id,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: { amount: true, name: true },
    });

    const agr = await prisma.dnxEconomicAgreement.findFirst({
      where: { scopeId: edition.id, status: "ACTIVE" },
      include: {
        currentVersion: {
          include: {
            rules: {
              include: {
                agreementParticipant: {
                  include: {
                    financialIdentity: { select: { id: true, ownerUserId: true } },
                    paymentAccount: {
                      select: { id: true, status: true, environment: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const rules = agr?.currentVersion?.rules ?? [];
    const sumBps = rules.reduce((s, r) => s + Number(r.value), 0);
    const primary = rules.find((r) => Number(r.value) === 10000) ?? rules[0];
    const pa = primary?.agreementParticipant.paymentAccount;
    const ownerUserId = primary?.agreementParticipant.financialIdentity.ownerUserId;
    const ownerUser = ownerUserId
      ? await prisma.user.findUnique({
          where: { id: ownerUserId },
          select: { email: true },
        })
      : null;

    const result = preflightClickatonLivePayments({
      expectedAmountArs: phase ? Number(phase.amount) / 100 : null,
      recipientEmail: ownerUser?.email ?? null,
      recipientPaymentAccountId: pa?.id ?? null,
      recipientAccountStatus: pa?.status ?? null,
      recipientAccountEnvironment: pa?.environment ?? null,
      allocationSumPercent: sumBps / 100,
      registrationEnabled: edition.registrationEnabled,
      collectorTokenPresent: true,
      ownerPaymentAccountIdExpected: "pa_ba733fa7a35f4326",
      ownerPaymentAccountIdActual: pa?.id ?? null,
    });

    console.log(
      JSON.stringify(
        {
          edition: {
            id: edition.id,
            registrationEnabled: edition.registrationEnabled,
            status: edition.status,
          },
          phaseName: phase?.name ?? null,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
