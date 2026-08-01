/**
 * 10G.8 — Pre-GO audit: prove LIVE smoke evidence + commercial/finance config.
 * Read-only (no open sales, no LIVE flag change).
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";
import { resolveCollectorAccessTokenFromPaymentAccount } from "../lib/admin/edition-finance/infrastructure/resolve-collector-token";
import {
  ARGENTINA_2026_MERCH,
  ARGENTINA_2026_SCHEDULE,
  CLICKATON_TERMS_VERSION,
} from "../config/editions/argentina-2026";
import { clickatonLegalFunnelContent } from "../content/legal-funnel";

const REG = "cms9jxbh90001xp8soyj2ff7m";
const ORDER = "dnx_ord_eedc170407b647e1";
const PAYMENT_ID = "171469277830";
const CANONICAL_PA = "pa_ba733fa7a35f4326";
const COLLECTOR = "97484805";
const RECIPIENT = "dnxfotografia@gmail.com";
const OWNER = "cuart.daniel@gmail.com";
const TERMS = "CLICKATON_TERMS_2026_09_19_v2";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("requires_production_database");
  }

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      items: true,
      credential: { include: { qrTokens: true } },
      welcomeCards: { select: { id: true, status: true } },
      user: { select: { id: true, email: true } },
      audits: {
        where: {
          action: {
            in: ["EMAIL_SENT", "EMAIL_QUEUED", "EMAIL_FAILED", "PAYMENT_APPROVED_CONFIRMED"],
          },
        },
        select: { action: true, source: true, createdAt: true, metadata: true },
      },
    },
  });
  const order = await prisma.dnxPaymentOrder.findUnique({
    where: { id: ORDER },
    select: { status: true, amountMinor: true, environment: true, provider: true },
  });
  const allocations = await prisma.dnxPaymentOrderAllocation.findMany({
    where: { paymentOrderId: ORDER },
    select: { role: true, basisPoints: true, chargedAmount: true },
  });

  const tok = await resolveCollectorAccessTokenFromPaymentAccount(CANONICAL_PA);
  let mp: Record<string, unknown> | null = null;
  if (tok.ok) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${PAYMENT_ID}`, {
      headers: { Authorization: `Bearer ${tok.accessToken}` },
    });
    if (res.ok) {
      const p = (await res.json()) as Record<string, unknown>;
      mp = {
        id: p.id,
        status: p.status,
        status_detail: p.status_detail,
        live_mode: p.live_mode,
        transaction_amount: p.transaction_amount,
        collector_id: p.collector_id,
        payer_id: (p.payer as { id?: unknown } | undefined)?.id ?? null,
        external_reference: p.external_reference,
      };
    }
  }

  let vault: "PASS" | "FAIL" = "FAIL";
  try {
    const v = new CredentialVault(createPrismaCredentialStore(prisma as never));
    const pa = await prisma.dnxPaymentAccount.findUnique({
      where: { id: CANONICAL_PA },
      select: { credentialReference: true },
    });
    if (pa?.credentialReference) {
      const p = await v.decryptMercadoPagoCredential(pa.credentialReference);
      vault = p.accessToken && p.accessToken.length > 10 ? "PASS" : "FAIL";
    }
  } catch {
    vault = "FAIL";
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    select: {
      id: true,
      status: true,
      isPublished: true,
      registrationEnabled: true,
      startAt: true,
      rulesConfig: true,
      pricePhases: {
        where: { isActive: true },
        orderBy: { priority: "asc" },
        select: {
          name: true,
          amount: true,
          startsAt: true,
          endsAt: true,
          priority: true,
        },
      },
    },
  });
  const rules = (edition?.rulesConfig ?? {}) as {
    termsVersion?: string;
    schedule?: Record<string, string>;
  };

  // Finance owner
  const agr = await prisma.dnxEconomicAgreement.findFirst({
    where: { scopeId: edition?.id ?? "__none__", status: "ACTIVE" },
    include: {
      currentVersion: {
        include: {
          rules: {
            include: {
              agreementParticipant: {
                include: {
                  financialIdentity: { select: { ownerUserId: true } },
                  paymentAccount: {
                    select: { id: true, providerUserId: true, environment: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const agrRules = agr?.currentVersion?.rules ?? [];
  const sumBps = agrRules.reduce((s, r) => s + Number(r.value), 0);
  const primary = agrRules.find((r) => Number(r.value) === 10000) ?? agrRules[0];
  const ownerUid = primary?.agreementParticipant.financialIdentity.ownerUserId;
  const ownerUser = ownerUid
    ? await prisma.user.findUnique({ where: { id: ownerUid }, select: { email: true } })
    : null;
  const recipientUid = primary?.agreementParticipant.financialIdentity.ownerUserId;
  // recipient email from same primary participant owner (DNX)
  const recipientEmail = ownerUser?.email?.toLowerCase() ?? null;

  // For Clickatón, finance owner may be separate — check edition finance owner if model exists
  let financeOwnerEmail: string | null = null;
  try {
    const ownerLink = await prisma.dnxFinancialIdentity.findFirst({
      where: {
        paymentAccounts: { some: { id: CANONICAL_PA } },
      },
      select: { ownerUserId: true },
    });
    if (ownerLink?.ownerUserId) {
      const u = await prisma.user.findUnique({
        where: { id: ownerLink.ownerUserId },
        select: { email: true },
      });
      financeOwnerEmail = u?.email?.toLowerCase() ?? null;
    }
  } catch {
    financeOwnerEmail = null;
  }

  const emailAudit = (reg?.audits ?? []).find(
    (a) => a.action === "EMAIL_SENT" || a.action === "EMAIL_QUEUED",
  );

  const scheduleCodeOk =
    ARGENTINA_2026_SCHEDULE.accreditationOpenIso.includes("T14:00:00") &&
    ARGENTINA_2026_SCHEDULE.talkOpenIso.includes("T16:00:00") &&
    ARGENTINA_2026_SCHEDULE.captureOpenIso.includes("T16:00:00") &&
    ARGENTINA_2026_SCHEDULE.captureCloseIso.includes("T20:00:00") &&
    ARGENTINA_2026_SCHEDULE.uploadCloseIso.includes("T22:00:00") &&
    CLICKATON_TERMS_VERSION === TERMS &&
    clickatonLegalFunnelContent.termsVersion === TERMS &&
    clickatonLegalFunnelContent.publicationStatus === "PUBLISHED";

  const phases = (edition?.pricePhases ?? []).map((p) => ({
    name: p.name,
    amountArs: Number(p.amount) / 100,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    priority: p.priority,
  }));
  const now = Date.now();
  const currentPhase = (edition?.pricePhases ?? []).find(
    (p) => p.startsAt.getTime() <= now && p.endsAt.getTime() >= now,
  );

  // tighten recipient check with agreement
  const agreementRecipientOk =
    sumBps === 10000 &&
    primary?.agreementParticipant.paymentAccount?.id === CANONICAL_PA &&
    primary?.agreementParticipant.paymentAccount?.providerUserId === COLLECTOR;
  // Find user email for DNX identity
  const dnxUser = await prisma.user.findFirst({
    where: { email: { equals: RECIPIENT, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const ownerUserRow = await prisma.user.findFirst({
    where: { email: { equals: OWNER, mode: "insensitive" } },
    select: { id: true, email: true },
  });

  const smoke = {
    MP_APPROVED:
      mp?.status === "approved" && mp?.live_mode === true ? "PASS" : "FAIL",
    DNX_ORDER_PAID: order?.status === "PAID" ? "PASS" : "FAIL",
    REGISTRATION_CONFIRMED: reg?.status === "CONFIRMED" ? "PASS" : "FAIL",
    WEBHOOK_OR_RECONCILE: (reg?.audits ?? []).some(
      (a) => a.action === "PAYMENT_APPROVED_CONFIRMED",
    )
      ? "PASS"
      : "FAIL",
    RECIPIENT_DNX: agreementRecipientOk && dnxUser ? "PASS" : agreementRecipientOk ? "PASS" : "FAIL",
    ALLOCATION_100:
      allocations.length === 1 && allocations[0]?.basisPoints === 10000
        ? "PASS"
        : "FAIL",
    COLLECTOR:
      String(mp?.collector_id) === COLLECTOR &&
      primary?.agreementParticipant.paymentAccount?.providerUserId === COLLECTOR
        ? "PASS"
        : "FAIL",
    AMOUNT:
      Number(mp?.transaction_amount) === 25000 &&
      Number(order?.amountMinor) === 2_500_000
        ? "PASS"
        : "FAIL",
    TERMS_V2: reg?.termsVersion === TERMS && Boolean(reg.termsAcceptedAt) ? "PASS" : "FAIL",
    FIRST_N_TALLE:
      (reg?.items ?? []).some(
        (i) =>
          /remera/i.test(i.nameSnapshot ?? "") &&
          i.isIncluded &&
          i.variantNameSnapshot === "M",
      )
        ? "PASS"
        : "FAIL",
    CREDENTIAL_QR:
      reg?.credential?.status === "ACTIVE" &&
      (reg.credential.qrTokens?.some((t) => t.status === "ACTIVE") ?? false)
        ? "PASS"
        : "FAIL",
    EMAIL: emailAudit ? "PASS" : "FAIL",
    WELCOME:
      (reg?.welcomeCards.length ?? 0) >= 1 || Boolean(reg?.welcomeCardStatus)
        ? "PASS"
        : "FAIL",
    MI_CUENTA: reg?.status === "CONFIRMED" && reg.userId != null ? "PASS" : "FAIL",
    EXTERNAL_PAYER:
      mp?.payer_id != null && String(mp.payer_id) !== COLLECTOR ? "PASS" : "FAIL",
  };

  const config = {
    EDITION_STATUS: edition?.status === "REGISTRATION_OPEN" ? "PASS" : "FAIL",
    PRICE_25000: currentPhase && Number(currentPhase.amount) === 2_500_000 ? "PASS" : "FAIL",
    PHASES_30_35: (() => {
      const amounts = new Set(
        (edition?.pricePhases ?? []).map((p) => Number(p.amount) / 100),
      );
      return amounts.has(25000) && amounts.has(30000) && amounts.has(35000)
        ? "PASS"
        : "FAIL";
    })(),
    FIRST_100: ARGENTINA_2026_MERCH.firstNBenefitLimit === 100 ? "PASS" : "FAIL",
    DEADLINE_30_08: String(ARGENTINA_2026_MERCH.benefitDeadlineIso).includes("2026-08-30")
      ? "PASS"
      : "FAIL",
    TERMS_V2_ACTIVE: scheduleCodeOk && rules.termsVersion === TERMS ? "PASS" : "FAIL",
    LEGAL_PUBLISHED:
      clickatonLegalFunnelContent.publicationStatus === "PUBLISHED" ? "PASS" : "FAIL",
    VAULT: vault,
    FINANCE_PA: agreementRecipientOk ? "PASS" : "FAIL",
    FINANCE_OWNER_PRESENT: ownerUserRow ? "PASS" : "WARN",
    DNX_RECIPIENT_PRESENT: dnxUser ? "PASS" : "WARN",
    REGISTRATION_CURRENTLY_CLOSED: edition?.registrationEnabled === false ? "PASS" : "WARN",
  };

  const smokeRequired = [
    smoke.MP_APPROVED,
    smoke.DNX_ORDER_PAID,
    smoke.REGISTRATION_CONFIRMED,
    smoke.WEBHOOK_OR_RECONCILE,
    smoke.ALLOCATION_100,
    smoke.COLLECTOR,
    smoke.AMOUNT,
    smoke.TERMS_V2,
    smoke.FIRST_N_TALLE,
    smoke.CREDENTIAL_QR,
    smoke.WELCOME,
    smoke.MI_CUENTA,
    smoke.EXTERNAL_PAYER,
  ];
  // EMAIL is required by stage brief — currently FAIL from ops reconcile path
  const smokeCoreOk = smokeRequired.every((v) => v === "PASS");
  const emailOk = smoke.EMAIL === "PASS";
  const configOk = [
    config.EDITION_STATUS,
    config.PRICE_25000,
    config.PHASES_30_35,
    config.FIRST_100,
    config.DEADLINE_30_08,
    config.TERMS_V2_ACTIVE,
    config.LEGAL_PUBLISHED,
    config.VAULT,
    config.FINANCE_PA,
  ].every((v) => v === "PASS");

  const canGo = smokeCoreOk && configOk && emailOk;
  const verdict = canGo
    ? "CLICKATON PUBLIC SALES GO READY"
    : !smokeCoreOk
      ? "CLICKATON PUBLIC SALES GO BLOCKED"
      : !emailOk
        ? "CLICKATON PUBLIC SALES GO BLOCKED — EMAIL EVIDENCE MISSING"
        : "CLICKATON PUBLIC SALES GO BLOCKED";

  const out = {
    stage: "10G.8",
    step: "pre_go_audit",
    smokeEvidence: {
      registrationId: REG,
      orderId: ORDER,
      providerPaymentId: PAYMENT_ID,
      mp,
      registration: {
        status: reg?.status,
        paymentStatus: reg?.paymentStatus,
        termsVersion: reg?.termsVersion,
        termsAcceptedAt: reg?.termsAcceptedAt,
        email: reg?.email,
        userId: reg?.user?.id,
        credential: reg?.credential
          ? {
              status: reg.credential.status,
              publicCode: reg.credential.publicCode,
              qrActive: reg.credential.qrTokens.filter((t) => t.status === "ACTIVE")
                .length,
            }
          : null,
        welcomeCards: reg?.welcomeCards,
        items: reg?.items.map((i) => ({
          name: i.nameSnapshot,
          variant: i.variantNameSnapshot,
          included: i.isIncluded,
        })),
      },
      order: order
        ? {
            status: order.status,
            amountMinor: Number(order.amountMinor),
            environment: order.environment,
          }
        : null,
      allocations: allocations.map((a) => ({
        role: a.role,
        basisPoints: a.basisPoints,
        chargedAmount: Number(a.chargedAmount),
      })),
      emailAudits: reg?.audits ?? [],
    },
    smoke,
    config,
    phases,
    currentPhaseAmountArs: currentPhase ? Number(currentPhase.amount) / 100 : null,
    finance: {
      ownerExpected: OWNER,
      ownerFound: ownerUserRow?.email ?? null,
      recipientExpected: RECIPIENT,
      recipientFound: dnxUser?.email ?? null,
      agreementSumBps: sumBps,
      pa: primary?.agreementParticipant.paymentAccount ?? null,
      vault,
    },
    legal: {
      termsVersion: CLICKATON_TERMS_VERSION,
      publicationStatus: clickatonLegalFunnelContent.publicationStatus,
      dbTerms: rules.termsVersion ?? null,
    },
    canGo,
    blockers: [
      ...(!smokeCoreOk ? ["SMOKE_CORE_INCOMPLETE"] : []),
      ...(!emailOk
        ? ["EMAIL_NOT_SENT_ON_SMOKE_REG — ops reconcile skipped notifier"]
        : []),
      ...(!configOk ? ["COMMERCIAL_OR_FINANCE_CONFIG"] : []),
    ],
    verdict,
  };

  writeFileSync("/tmp/clickaton-10g8-pre-go-audit.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!canGo) process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
