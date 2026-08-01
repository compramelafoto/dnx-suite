/**
 * 10G.5 — Preflight gate (read-only) before controlled LIVE E2E.
 * Stops with SCHEDULE V2 REQUIRED / LIVE PREFLIGHT BLOCKED if needed.
 */
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";
import { preflightClickatonLivePayments } from "@repo/payments/next";
import {
  ARGENTINA_2026_MERCH,
  ARGENTINA_2026_SCHEDULE,
  CLICKATON_TERMS_VERSION,
} from "../config/editions/argentina-2026";
import { clickatonLegalFunnelContent } from "../content/legal-funnel";

const CANONICAL_PA = "pa_ba733fa7a35f4326";
const EXPECTED_PROVIDER = "97484805";
const RECIPIENT = "dnxfotografia@gmail.com";

async function main() {
  const blockers: string[] = [];

  // 1 — Schedule / Terms V2 (code + DB)
  const scheduleOk =
    ARGENTINA_2026_SCHEDULE.accreditationOpenIso.includes("T14:00:00") &&
    ARGENTINA_2026_SCHEDULE.talkOpenIso.includes("T16:00:00") &&
    ARGENTINA_2026_SCHEDULE.talkCloseIso.includes("T16:30:00") &&
    ARGENTINA_2026_SCHEDULE.captureOpenIso.includes("T16:00:00") &&
    ARGENTINA_2026_SCHEDULE.captureCloseIso.includes("T20:00:00") &&
    ARGENTINA_2026_SCHEDULE.uploadOpenIso.includes("T16:00:00") &&
    ARGENTINA_2026_SCHEDULE.uploadCloseIso.includes("T22:00:00") &&
    CLICKATON_TERMS_VERSION === "CLICKATON_TERMS_2026_09_19_v2" &&
    clickatonLegalFunnelContent.termsVersion ===
      "CLICKATON_TERMS_2026_09_19_v2" &&
    clickatonLegalFunnelContent.publicationStatus === "PUBLISHED";

  if (!scheduleOk) blockers.push("SCHEDULE_OR_TERMS_V2_CODE");

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    select: {
      id: true,
      status: true,
      isPublished: true,
      registrationEnabled: true,
      startAt: true,
      endAt: true,
      rulesConfig: true,
      timezone: true,
    },
  });
  if (!edition) blockers.push("EDITION_MISSING");

  const rulesConfig = (edition?.rulesConfig ?? {}) as {
    termsVersion?: string;
    schedule?: Record<string, string>;
  };
  if (rulesConfig.termsVersion !== "CLICKATON_TERMS_2026_09_19_v2") {
    blockers.push("DB_TERMS_NOT_V2");
  }
  const dbSched = rulesConfig.schedule ?? {};
  if (
    !String(dbSched.captureOpenIso ?? "").includes("T16:00:00") ||
    !String(dbSched.captureCloseIso ?? "").includes("T20:00:00") ||
    !String(dbSched.uploadCloseIso ?? "").includes("T22:00:00")
  ) {
    blockers.push("DB_SCHEDULE_NOT_V2");
  }

  const prompt = await prisma.clickatonPrompt.findFirst({
    where: { editionId: edition?.id ?? "__none__" },
    select: {
      captureStartsAt: true,
      captureEndsAt: true,
      uploadStartsAt: true,
      uploadEndsAt: true,
    },
  });
  // 16:00 AR = 19:00Z, 20:00 AR = 23:00Z, 22:00 AR = 01:00Z next day
  const captureStartOk =
    prompt?.captureStartsAt?.toISOString() === "2026-09-19T19:00:00.000Z";
  const captureEndOk =
    prompt?.captureEndsAt?.toISOString() === "2026-09-19T23:00:00.000Z";
  const uploadEndOk =
    prompt?.uploadEndsAt?.toISOString() === "2026-09-20T01:00:00.000Z";
  if (!captureStartOk || !captureEndOk || !uploadEndOk) {
    blockers.push("PROMPT_WINDOWS_NOT_V2");
  }

  // 2 — Finance + vault
  const pa = await prisma.dnxPaymentAccount.findUnique({
    where: { id: CANONICAL_PA },
    select: {
      id: true,
      status: true,
      environment: true,
      providerUserId: true,
      credentialReference: true,
      financialIdentityId: true,
    },
  });
  let vault: "PASS" | "FAIL" | "NO_KEY" = "NO_KEY";
  const masterLen = (process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY ?? "").trim()
    .length;
  if (masterLen >= 32 && pa?.credentialReference) {
    try {
      const v = new CredentialVault(createPrismaCredentialStore(prisma as never));
      const p = await v.decryptMercadoPagoCredential(pa.credentialReference);
      vault =
        Boolean(p.accessToken?.trim()) && p.accessToken!.trim().length > 10
          ? "PASS"
          : "FAIL";
    } catch {
      vault = "FAIL";
    }
  }
  if (
    !pa ||
    pa.status !== "ACTIVE" ||
    pa.environment !== "PROD" ||
    pa.providerUserId !== EXPECTED_PROVIDER
  ) {
    blockers.push("COLLECTOR_NOT_READY");
  }
  if (vault !== "PASS") blockers.push("VAULT_NOT_PASS");

  const agr = edition
    ? await prisma.dnxEconomicAgreement.findFirst({
        where: { scopeId: edition.id, status: "ACTIVE" },
        include: {
          currentVersion: {
            include: {
              rules: {
                include: {
                  agreementParticipant: {
                    include: {
                      financialIdentity: { select: { ownerUserId: true } },
                      paymentAccount: {
                        select: { id: true, providerUserId: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;
  const rules = agr?.currentVersion?.rules ?? [];
  const sumBps = rules.reduce((s, r) => s + Number(r.value), 0);
  const primary = rules.find((r) => Number(r.value) === 10000) ?? rules[0];
  const ownerUid = primary?.agreementParticipant.financialIdentity.ownerUserId;
  const recipientUser = ownerUid
    ? await prisma.user.findUnique({
        where: { id: ownerUid },
        select: { email: true },
      })
    : null;
  if (sumBps !== 10000) blockers.push("ALLOCATION_NOT_100");
  if (recipientUser?.email?.toLowerCase() !== RECIPIENT) {
    blockers.push("RECIPIENT_MISMATCH");
  }
  if (primary?.agreementParticipant.paymentAccount?.id !== CANONICAL_PA) {
    blockers.push("RECIPIENT_PA_NOT_CANONICAL");
  }
  if (
    primary?.agreementParticipant.paymentAccount?.providerUserId !==
    EXPECTED_PROVIDER
  ) {
    blockers.push("PROVIDER_MISMATCH");
  }

  const now = new Date();
  const phase = edition
    ? await prisma.clickatonRegistrationPricePhase.findFirst({
        where: {
          editionId: edition.id,
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        include: {
          includedItems: {
            where: { isIncluded: true },
            include: {
              product: {
                include: {
                  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      })
    : null;
  const amountArs = phase ? Number(phase.amount) / 100 : null;
  if (amountArs !== 25_000) blockers.push("AMOUNT_NOT_25000");

  // 3 — Remera
  const shirtItem = phase?.includedItems.find(
    (i) =>
      i.product.code === "REMERA-CLICKATON" || i.product.code === "REMERA_CLICKATON",
  );
  const sizes = shirtItem?.product.variants.map((v) => v.sizeCode ?? v.code) ?? [];
  const benefitDeadline = ARGENTINA_2026_MERCH.benefitDeadlineIso;
  const confirmedWithShirt = edition
    ? await prisma.clickatonRegistration.count({
        where: {
          editionId: edition.id,
          status: "CONFIRMED",
          items: {
            some: {
              isIncluded: true,
              OR: [
                { productNameSnapshot: { contains: "Remera", mode: "insensitive" } },
                { skuSnapshot: { contains: "REMERA", mode: "insensitive" } },
                { nameSnapshot: { contains: "Remera", mode: "insensitive" } },
              ],
            },
          },
        },
      })
    : 0;

  const preflight = preflightClickatonLivePayments({
    expectedAmountArs: amountArs,
    recipientEmail: recipientUser?.email ?? null,
    recipientPaymentAccountId:
      primary?.agreementParticipant.paymentAccount?.id ?? null,
    recipientAccountStatus: pa?.status ?? null,
    recipientAccountEnvironment: pa?.environment ?? null,
    allocationSumPercent: sumBps / 100,
    registrationEnabled: edition?.registrationEnabled ?? false,
    collectorTokenPresent: vault === "PASS",
    ownerPaymentAccountIdExpected: CANONICAL_PA,
    ownerPaymentAccountIdActual: pa?.id ?? null,
  });

  if (!preflight.ok && preflight.configuration !== "READY_CONFIGURATION") {
    blockers.push("PREFLIGHT_CONFIG");
  }
  if (edition?.registrationEnabled !== false) {
    // not a hard blocker for gate — we'll open briefly later
  }

  const scheduleBlocked = blockers.some(
    (b) =>
      b.includes("SCHEDULE") ||
      b.includes("TERMS") ||
      b.includes("PROMPT_WINDOWS") ||
      b.includes("DB_SCHEDULE") ||
      b.includes("DB_TERMS"),
  );

  let verdict:
    | "SCHEDULE V2 REQUIRED BEFORE LIVE E2E"
    | "LIVE PREFLIGHT BLOCKED"
    | "LIVE PREFLIGHT GATE PASS" = "LIVE PREFLIGHT GATE PASS";

  if (scheduleBlocked) verdict = "SCHEDULE V2 REQUIRED BEFORE LIVE E2E";
  else if (blockers.length) verdict = "LIVE PREFLIGHT BLOCKED";

  console.log(
    JSON.stringify(
      {
        stage: "10G.5",
        step: "preflight_gate",
        scheduleV2: {
          codeOk: scheduleOk,
          termsVersion: CLICKATON_TERMS_VERSION,
          legalPublished: clickatonLegalFunnelContent.publicationStatus,
          dbTerms: rulesConfig.termsVersion ?? null,
          promptWindows: {
            captureStartsAt: prompt?.captureStartsAt?.toISOString() ?? null,
            captureEndsAt: prompt?.captureEndsAt?.toISOString() ?? null,
            uploadEndsAt: prompt?.uploadEndsAt?.toISOString() ?? null,
            ok: captureStartOk && captureEndOk && uploadEndOk,
          },
        },
        finance: {
          collector: pa,
          vault,
          recipient: recipientUser?.email ?? null,
          allocationPercent: sumBps / 100,
          amountArs,
        },
        remera: {
          firstN: ARGENTINA_2026_MERCH.firstNBenefitLimit,
          deadlineIso: benefitDeadline,
          confirmedConsumingApprox: confirmedWithShirt,
          note: "PENDING_PAYMENT does not consume first-N; only CONFIRMED",
          sizesAvailable: sizes,
          shirtIncludedInPhase: Boolean(shirtItem),
        },
        edition: {
          status: edition?.status,
          isPublished: edition?.isPublished,
          registrationEnabled: edition?.registrationEnabled,
        },
        preflight: {
          ok: preflight.ok,
          configuration: preflight.configuration,
          liveExecution: preflight.liveExecution,
          checks: preflight.checks,
          projected: preflight.projected,
        },
        liveFlag: process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED ?? null,
        blockers,
        verdict,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  if (verdict !== "LIVE PREFLIGHT GATE PASS") process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
