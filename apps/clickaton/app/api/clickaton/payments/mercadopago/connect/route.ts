import { NextResponse } from "next/server";
import {
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  readClickatonMpOAuthAppConfig,
  CLICKATON_MP_REDIRECTS,
  CLICKATON_MP_NOTIFICATION_URLS,
} from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/clickaton/payments/mercadopago/connect
 *
 * Prepares / starts Clickatón owner OAuth. Live authorize redirect only when:
 * - DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED=on
 * - Manual authorization phrase env set exactly
 * - Dedicated Clickatón MP app credentials present
 *
 * Without manual auth: returns 403 and does NOT open OAuth.
 */
export async function GET() {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!isOwnerOnboardingEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ONBOARDING_FLAG_OFF" },
      { status: 403 },
    );
  }

  const app = readClickatonMpOAuthAppConfig();
  const checklist = {
    onboardingFlag: true,
    manualAuthorization: canStartLiveOwnerOAuth(),
    requiredPhrase: OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
    appConfigured: app.configured,
    appMissing: app.missing,
    redirects: CLICKATON_MP_REDIRECTS,
    notifications: CLICKATON_MP_NOTIFICATION_URLS,
    note: "Live OAuth is not started automatically. Set manual authorization env after Daniel confirms the exact phrase.",
  };

  if (!canStartLiveOwnerOAuth()) {
    return NextResponse.json(
      {
        ok: false,
        error: "OWNER_OAUTH_NOT_AUTHORIZED",
        checklist,
      },
      { status: 403 },
    );
  }

  if (!app.configured) {
    return NextResponse.json(
      {
        ok: false,
        error: "APP_NOT_CONFIGURED",
        checklist,
      },
      { status: 503 },
    );
  }

  // Finance-owner grant + vault + state persistence are enforced in
  // ClickatonOwnerOAuthService when wired to Prisma (I1 domain ready).
  // This HTTP surface intentionally refuses to invent a live redirect without
  // the service runtime binding — return ready status for operators.
  return NextResponse.json({
    ok: true,
    status: "READY_FOR_SERVICE_START",
    checklist,
    message:
      "Manual authorization present. Invoke ClickatonOwnerOAuthService.startConnect with DNX_FINANCE_OWNER actor to obtain authorize URL.",
  });
}
