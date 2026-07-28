import { NextResponse } from "next/server";
import {
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  readClickatonMpOAuthAppConfig,
  CLICKATON_MP_REDIRECTS,
  CLICKATON_MP_NOTIFICATION_URLS,
  OwnerOAuthError,
} from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  createOwnerOAuthRuntime,
  mapOwnerOAuthError,
} from "@/lib/admin/mp-owner-oauth/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/clickaton/payments/mercadopago/connect
 * Starts owner OAuth and redirects to Mercado Pago when authorized.
 */
export async function GET(request: Request) {
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
  };

  if (!canStartLiveOwnerOAuth()) {
    return NextResponse.json(
      { ok: false, error: "OWNER_OAUTH_NOT_AUTHORIZED", checklist },
      { status: 403 },
    );
  }

  if (!app.configured) {
    return NextResponse.json(
      { ok: false, error: "APP_NOT_CONFIGURED", checklist },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const wantsJson = url.searchParams.get("format") === "json";

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable, redirectUri } = createOwnerOAuthRuntime();
    if (!vaultAvailable) {
      return NextResponse.json(
        {
          ok: false,
          error: "VAULT_UNAVAILABLE",
          message: "DNX_FINANCIAL_CREDENTIAL_MASTER_KEY missing",
          checklist,
        },
        { status: 503 },
      );
    }

    const started = await service.startConnect({
      actor,
      redirectUri,
    });

    // Never put tokens in the response — only authorize URL (MP hosted).
    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        authorizeUrl: started.authorizeUrl,
        stateId: started.stateId,
        expiresAt: started.expiresAt,
        redirectUri,
      });
    }

    return NextResponse.redirect(started.authorizeUrl, 302);
  } catch (err) {
    if (err instanceof OwnerOAuthError || (err && typeof err === "object" && "code" in err)) {
      const mapped = mapOwnerOAuthError(err);
      return NextResponse.json(
        { ok: false, error: mapped.error, message: mapped.message, checklist },
        { status: mapped.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "OWNER_OAUTH_FAILED", checklist },
      { status: 500 },
    );
  }
}
