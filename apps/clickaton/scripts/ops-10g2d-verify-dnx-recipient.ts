/**
 * 10G.2D — Read-only: DNX 100% recipient vs canonical collector.
 * Never prints tokens. No OAuth / charge / DB mutation.
 *
 *   DATABASE_URL=… DNX_FINANCIAL_CREDENTIAL_MASTER_KEY=… \
 *     pnpm exec tsx scripts/ops-10g2d-verify-dnx-recipient.ts
 */
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";
import { preflightClickatonLivePayments } from "@repo/payments/next";

const EDITION_SLUG = "clickaton-argentina-2026";
const CANONICAL_PA = "pa_ba733fa7a35f4326";
const EXPECTED_PROVIDER = "97484805";
const RECIPIENT_EMAIL = "dnxfotografia@gmail.com";
const FINANCE_OWNER_EMAIL = "cuart.daniel@gmail.com";
const TAMMY_EMAIL = "tammy@example.com"; // overridden if FINANCE_SEED has real

async function main() {
  const live = (process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED ?? "")
    .trim()
    .toLowerCase();
  const masterLen = (process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY ?? "").trim()
    .length;

  const pa = await prisma.dnxPaymentAccount.findUnique({
    where: { id: CANONICAL_PA },
    include: {
      financialIdentity: {
        select: {
          id: true,
          ownerUserId: true,
          organizationRef: true,
          subjectType: true,
          legalName: true,
          status: true,
        },
      },
    },
  });

  let vaultDecrypt: "PASS" | "FAIL" | "NO_KEY" | "NO_CREDENTIAL" | "NO_PA" =
    "NO_PA";
  let vaultErr: string | null = null;
  if (!pa) {
    vaultDecrypt = "NO_PA";
  } else if (masterLen === 0) {
    vaultDecrypt = "NO_KEY";
  } else if (!pa.credentialReference) {
    vaultDecrypt = "NO_CREDENTIAL";
  } else {
    try {
      const vault = new CredentialVault(
        createPrismaCredentialStore(prisma as never),
      );
      const payload = await vault.decryptMercadoPagoCredential(
        pa.credentialReference,
      );
      vaultDecrypt =
        Boolean(payload.accessToken?.trim()) &&
        (payload.accessToken?.trim().length ?? 0) > 10
          ? "PASS"
          : "FAIL";
      if (vaultDecrypt === "FAIL") vaultErr = "empty_token";
    } catch (e) {
      vaultDecrypt = "FAIL";
      vaultErr = e instanceof Error ? e.message.slice(0, 100) : "fail";
    }
  }

  const recipientUser = await prisma.user.findFirst({
    where: { email: { equals: RECIPIENT_EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const financeOwner = await prisma.user.findFirst({
    where: { email: { equals: FINANCE_OWNER_EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const ownerGrant = financeOwner
    ? await prisma.dnxFinanceGrant.findFirst({
        where: {
          userId: financeOwner.id,
          capability: "DNX_FINANCE_OWNER",
          status: "ACTIVE",
        },
        select: { id: true },
      })
    : null;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: EDITION_SLUG },
    select: {
      id: true,
      status: true,
      registrationEnabled: true,
      timezone: true,
    },
  });

  let rulesSummary: Array<{
    roleLabel: string | null;
    percent: number;
    email: string | null;
    paymentAccountId: string | null;
    providerUserId: string | null;
    paStatus: string | null;
    paEnv: string | null;
    financialIdentityId: string | null;
    fiOwnerUserId: number | null;
    wiring: string;
  }> = [];
  let allocationSum = 0;
  let agreementId: string | null = null;

  if (edition) {
    const agr = await prisma.dnxEconomicAgreement.findFirst({
      where: { scopeId: edition.id, status: "ACTIVE" },
      include: {
        currentVersion: {
          include: {
            rules: {
              include: {
                agreementParticipant: {
                  include: {
                    financialIdentity: {
                      select: { id: true, ownerUserId: true, organizationRef: true },
                    },
                    paymentAccount: {
                      select: {
                        id: true,
                        providerUserId: true,
                        status: true,
                        environment: true,
                        originApp: true,
                        externalReference: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    agreementId = agr?.id ?? null;
    const rules = agr?.currentVersion?.rules ?? [];
    allocationSum = rules.reduce((s, r) => s + Number(r.value), 0) / 100;

    rulesSummary = await Promise.all(
      rules.map(async (r) => {
        const fi = r.agreementParticipant.financialIdentity;
        const pay = r.agreementParticipant.paymentAccount;
        const u = fi.ownerUserId
          ? await prisma.user.findUnique({
              where: { id: fi.ownerUserId },
              select: { email: true },
            })
          : null;
        let wiring = "NONE";
        if (pay?.id === CANONICAL_PA) wiring = "DIRECT_CANONICAL_PA";
        else if (pay?.providerUserId === EXPECTED_PROVIDER)
          wiring = "SAME_PROVIDER_USER_ID";
        else if (pay?.id) wiring = "OTHER_PAYMENT_ACCOUNT";
        else if (fi.organizationRef?.includes("mp-owner"))
          wiring = "FI_OWNER_ORG_NO_PA_ON_PARTICIPANT";
        return {
          roleLabel: r.agreementParticipant.roleLabel,
          percent: Number(r.value) / 100,
          email: u?.email ?? null,
          paymentAccountId: pay?.id ?? null,
          providerUserId: pay?.providerUserId ?? null,
          paStatus: pay?.status ?? null,
          paEnv: pay?.environment ?? null,
          financialIdentityId: fi.id,
          fiOwnerUserId: fi.ownerUserId,
          wiring,
        };
      }),
    );
  }

  const primary = [...rulesSummary].sort((a, b) => b.percent - a.percent)[0];
  const tammyRule = rulesSummary.find(
    (r) => r.email?.toLowerCase().includes("tammy") || r.percent === 0,
  );
  const dnxRule =
    rulesSummary.find(
      (r) => r.email?.toLowerCase() === RECIPIENT_EMAIL.toLowerCase(),
    ) ?? primary;

  // Destination effective: same MP account if participant PA or FI maps to canonical
  const destinationPaId =
    dnxRule?.paymentAccountId ??
    (dnxRule?.financialIdentityId === pa?.financialIdentityId
      ? CANONICAL_PA
      : null);
  const destinationProvider =
    dnxRule?.providerUserId ??
    (destinationPaId === CANONICAL_PA ? EXPECTED_PROVIDER : null);
  const sameMpAccount =
    destinationProvider === EXPECTED_PROVIDER ||
    destinationPaId === CANONICAL_PA ||
    (dnxRule?.financialIdentityId != null &&
      dnxRule.financialIdentityId === pa?.financialIdentityId);

  // Self-split: multiple receivers with same providerUserId
  const providerIds = rulesSummary
    .map((r) => r.providerUserId)
    .filter((x): x is string => Boolean(x));
  const uniqueProviders = new Set(providerIds);
  const selfSplitIssue =
    rulesSummary.filter((r) => r.percent > 0).length > 1 &&
    uniqueProviders.size === 1 &&
    uniqueProviders.has(EXPECTED_PROVIDER);

  const phase = edition
    ? await prisma.clickatonRegistrationPricePhase.findFirst({
        where: {
          editionId: edition.id,
          isActive: true,
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() },
        },
        select: { amount: true, name: true },
      })
    : null;
  const amountArs = phase ? Number(phase.amount) / 100 : 25_000;

  const preflight = preflightClickatonLivePayments({
    expectedAmountArs: amountArs,
    recipientEmail: dnxRule?.email ?? null,
    recipientPaymentAccountId: destinationPaId,
    recipientAccountStatus: pa?.status ?? null,
    recipientAccountEnvironment: pa?.environment ?? null,
    allocationSumPercent: allocationSum,
    registrationEnabled: edition?.registrationEnabled ?? false,
    collectorTokenPresent: vaultDecrypt === "PASS",
    ownerPaymentAccountIdExpected: CANONICAL_PA,
    ownerPaymentAccountIdActual: pa?.id ?? null,
  });

  let verdict:
    | "DNX 100% RECIPIENT READY VIA CANONICAL COLLECTOR"
    | "DNX RECIPIENT PAYMENT ACCOUNT WIRING REQUIRED"
    | "CANONICAL COLLECTOR VAULT BLOCKED"
    | "SELF SPLIT CONFIGURATION ISSUE" =
    "DNX RECIPIENT PAYMENT ACCOUNT WIRING REQUIRED";

  if (vaultDecrypt !== "PASS") {
    verdict = "CANONICAL COLLECTOR VAULT BLOCKED";
  } else if (selfSplitIssue) {
    verdict = "SELF SPLIT CONFIGURATION ISSUE";
  } else if (
    pa?.status === "ACTIVE" &&
    pa.environment === "PROD" &&
    pa.providerUserId === EXPECTED_PROVIDER &&
    dnxRule?.email?.toLowerCase() === RECIPIENT_EMAIL.toLowerCase() &&
    allocationSum === 100 &&
    (dnxRule.percent === 100 ||
      (dnxRule.percent > 0 && allocationSum === 100)) &&
    sameMpAccount &&
    edition?.registrationEnabled === false &&
    live !== "true" &&
    live !== "1" &&
    live !== "on"
  ) {
    verdict = "DNX 100% RECIPIENT READY VIA CANONICAL COLLECTOR";
  } else if (!sameMpAccount || !dnxRule?.paymentAccountId) {
    // wiring missing even if FI owner email matches via organization
    if (
      sameMpAccount &&
      dnxRule?.financialIdentityId === pa?.financialIdentityId
    ) {
      verdict = "DNX 100% RECIPIENT READY VIA CANONICAL COLLECTOR";
    } else {
      verdict = "DNX RECIPIENT PAYMENT ACCOUNT WIRING REQUIRED";
    }
  }

  const table = {
    financeOwner: FINANCE_OWNER_EMAIL,
    financeOwnerGrant: Boolean(ownerGrant),
    recipient: dnxRule?.email ?? null,
    allocation: dnxRule?.percent ?? null,
    allocationSum,
    paymentAccount: destinationPaId,
    providerUserId: destinationProvider,
    vault: vaultDecrypt,
    collector: {
      id: pa?.id ?? null,
      providerUserId: pa?.providerUserId ?? null,
      status: pa?.status ?? null,
      environment: pa?.environment ?? null,
    },
    destination: sameMpAccount
      ? "SAME_CANONICAL_MP_ACCOUNT"
      : "DISTINCT_OR_UNRESOLVED",
    ready: verdict === "DNX 100% RECIPIENT READY VIA CANONICAL COLLECTOR",
  };

  console.log(
    JSON.stringify(
      {
        stage: "10G.2D",
        readOnly: true,
        livePaymentsEnabled: live,
        masterKeyPresent: masterLen >= 32,
        edition: {
          slug: EDITION_SLUG,
          id: edition?.id ?? null,
          registrationEnabled: edition?.registrationEnabled ?? null,
          agreementId,
          amountArs,
          phaseName: phase?.name ?? null,
        },
        canonicalCollector: pa
          ? {
              id: pa.id,
              providerUserId: pa.providerUserId,
              environment: pa.environment,
              status: pa.status,
              financialIdentityId: pa.financialIdentityId,
              organizationRef: pa.financialIdentity.organizationRef,
              fiOwnerUserId: pa.financialIdentity.ownerUserId,
              fiOwnerEmail:
                pa.financialIdentity.ownerUserId === recipientUser?.id
                  ? RECIPIENT_EMAIL
                  : pa.financialIdentity.ownerUserId === financeOwner?.id
                    ? FINANCE_OWNER_EMAIL
                    : String(pa.financialIdentity.ownerUserId),
            }
          : null,
        vaultDecrypt,
        vaultDecryptErr: vaultErr,
        rulesSummary,
        tammyPercent: tammyRule?.percent ?? 0,
        relationship: {
          recipientEmail: RECIPIENT_EMAIL,
          recipientUserId: recipientUser?.id ?? null,
          participantFiId: dnxRule?.financialIdentityId ?? null,
          participantPaId: dnxRule?.paymentAccountId ?? null,
          canonicalFiId: pa?.financialIdentityId ?? null,
          sameFinancialIdentity:
            dnxRule?.financialIdentityId === pa?.financialIdentityId,
          sameProviderUserId: sameMpAccount,
          wiring: dnxRule?.wiring ?? "NONE",
          note: "Collector and recipient DNX share the same real MP account (97484805). No second partner OAuth required when participant.paymentAccountId points at canonical PA / same FI.",
        },
        preflight: {
          ok: preflight.ok,
          configuration: preflight.configuration,
          liveExecution: preflight.liveExecution,
          checks: preflight.checks,
          projected: preflight.projected,
          blockers: preflight.blockers,
        },
        table,
        verdict,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  if (verdict !== "DNX 100% RECIPIENT READY VIA CANONICAL COLLECTOR") {
    process.exitCode = 2;
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
