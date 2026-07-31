/**
 * Preflight MP OAuth (10D.2 / 10D.2.1) — runtime only (Sensitive env).
 * No tokens, no secret values. No abre OAuth ni cobros.
 */
import {
  CLICKATON_MP_REDIRECTS,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
  isOwnerOAuthManuallyAuthorized,
  isPartnerSelfConnectEnabled,
  readClickatonMpOAuthAppConfig,
  resolvePartnerOAuthEnvironment,
} from "@repo/payments";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  return (
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1")
  );
}

function presence(name: string): "PRESENT" | "MISSING" {
  return process.env[name]?.trim() ? "PRESENT" : "MISSING";
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const expectedCallback = CLICKATON_MP_REDIRECTS.production;
  const redirectUri = process.env.CLICKATON_MP_REDIRECT_URI?.trim() || "";
  const app = readClickatonMpOAuthAppConfig();
  const provider = process.env.CLICKATON_DNX_PAYMENTS_PROVIDER?.trim() || "";
  const appUrl = process.env.APP_URL?.trim() || "";
  const webhookPublic = process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL?.trim() || "";
  const partnerEnabled = isPartnerSelfConnectEnabled();
  const partnerEnvironment = resolvePartnerOAuthEnvironment();

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    select: { id: true, isPublished: true, registrationEnabled: true, status: true },
  });

  const ownerIdentity = await prisma.dnxFinancialIdentity.findFirst({
    where: { organizationRef: "clickaton:partners-production:mp-owner" },
    select: {
      id: true,
      ownerUserId: true,
      paymentAccounts: {
        select: {
          id: true,
          status: true,
          environment: true,
          providerUserId: true,
          capabilities: true,
          credentialReference: true,
        },
        take: 5,
      },
    },
  });

  const ownerAccount = ownerIdentity?.paymentAccounts[0] ?? null;

  const env = {
    CLICKATON_DNX_PAYMENTS_PROVIDER: presence("CLICKATON_DNX_PAYMENTS_PROVIDER"),
    CLICKATON_MP_CLIENT_ID: presence("CLICKATON_MP_CLIENT_ID"),
    CLICKATON_MP_CLIENT_SECRET: presence("CLICKATON_MP_CLIENT_SECRET"),
    CLICKATON_MP_REDIRECT_URI: presence("CLICKATON_MP_REDIRECT_URI"),
    APP_URL: presence("APP_URL"),
    AUTH_SECRET: presence("AUTH_SECRET"),
    DNX_FINANCIAL_CREDENTIAL_MASTER_KEY: presence(
      "DNX_FINANCIAL_CREDENTIAL_MASTER_KEY",
    ),
    DNX_PAYMENTS_WEBHOOK_SECRET: presence("DNX_PAYMENTS_WEBHOOK_SECRET"),
    DNX_PAYMENTS_WEBHOOK_PUBLIC_URL: presence("DNX_PAYMENTS_WEBHOOK_PUBLIC_URL"),
    DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED: presence(
      "DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED",
    ),
    DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED: presence(
      "DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED",
    ),
    DNX_CLICKATON_MP_OWNER_OAUTH_AUTHORIZATION_PHRASE: presence(
      "DNX_CLICKATON_MP_OWNER_OAUTH_AUTHORIZATION_PHRASE",
    ),
    DNX_PARTNER_MP_SELF_CONNECT_ENABLED: presence(
      "DNX_PARTNER_MP_SELF_CONNECT_ENABLED",
    ),
  };

  const checks = {
    providerValueSanitized: provider || null,
    providerIsNotProductionForbidden: provider !== "mercado_pago_production",
    appConfigured: app.configured,
    redirectExactMatch: redirectUri === expectedCallback,
    redirectSanitized: redirectUri
      ? redirectUri.replace(/^(https:\/\/)[^/]+/, "$1…")
      : null,
    expectedCallback,
    appUrlHost: appUrl ? new URL(appUrl).host : null,
    webhookHost: webhookPublic ? new URL(webhookPublic).host : null,
    onboardingEnabled: isOwnerOnboardingEnabled(),
    manualAuthorized: isOwnerOAuthManuallyAuthorized(),
    canStartLiveOwnerOAuth: canStartLiveOwnerOAuth(),
    phraseConstantLen: OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE.length,
    registrationsOpen: Boolean(edition?.registrationEnabled),
    editionPublished: Boolean(edition?.isPublished),
    dbHostHint: process.env.DATABASE_URL?.includes("silent-haze")
      ? "ep-silent-haze…"
      : process.env.DATABASE_URL?.includes("round-fog")
        ? "ep-round-fog…(staging)"
        : "other_or_unknown",
    ownerAccountStatus: ownerAccount?.status ?? "NONE",
    ownerEnvironment: ownerAccount?.environment ?? null,
    ownerHasVaultRef: Boolean(ownerAccount?.credentialReference),
    ownerProviderUserIdPresent: Boolean(ownerAccount?.providerUserId),
    ownerCapabilities: ownerAccount?.capabilities ?? [],
    ownerIdentityOwnerUserId: ownerIdentity?.ownerUserId ?? null,
    partnerSelfConnectEnabled: partnerEnabled,
    partnerEnvironment,
    partnerFlowReady: partnerEnabled && app.configured,
  };

  const blockers: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (k === "DNX_PARTNER_MP_SELF_CONNECT_ENABLED") continue;
    if (v === "MISSING") blockers.push(`MISSING_ENV:${k}`);
  }
  if (!checks.appConfigured) blockers.push("MP_APP_NOT_CONFIGURED");
  if (!checks.redirectExactMatch && checks.dbHostHint === "ep-silent-haze…") {
    blockers.push("REDIRECT_URI_MISMATCH");
  }
  if (!checks.onboardingEnabled) blockers.push("OWNER_ONBOARDING_DISABLED");
  if (!checks.manualAuthorized) blockers.push("OWNER_OAUTH_NOT_MANUALLY_AUTHORIZED");
  if (!checks.canStartLiveOwnerOAuth) blockers.push("CANNOT_START_LIVE_OWNER_OAUTH");
  if (checks.registrationsOpen) blockers.push("REGISTRATIONS_OPEN_UNEXPECTED");
  if (
    checks.dbHostHint !== "ep-silent-haze…" &&
    checks.dbHostHint !== "ep-round-fog…(staging)"
  ) {
    blockers.push("DB_HOST_UNEXPECTED");
  }

  const partnerBlockers: string[] = [];
  if (!partnerEnabled) partnerBlockers.push("PARTNER_SELF_CONNECT_DISABLED");
  if (!checks.appConfigured) partnerBlockers.push("MP_APP_NOT_CONFIGURED");

  return NextResponse.json({
    ok: blockers.length === 0,
    verdict:
      blockers.length === 0
        ? "MP_LIVE_OAUTH_PREFLIGHT_PASS"
        : "MP_LIVE_OAUTH_PREFLIGHT_BLOCKED",
    partnerVerdict:
      partnerBlockers.length === 0
        ? "PARTNER_MP_PREFLIGHT_PASS"
        : "MP_LIVE_PARTNER_PREFLIGHT_BLOCKED",
    env,
    checks,
    blockers,
    partnerBlockers,
    note: "Owner OAuth requires DNX_FINANCE_OWNER. Partner requires DNX_FINANCE_PARTNER_CONNECT + DNX_PARTNER_MP_SELF_CONNECT_ENABLED.",
  });
}
