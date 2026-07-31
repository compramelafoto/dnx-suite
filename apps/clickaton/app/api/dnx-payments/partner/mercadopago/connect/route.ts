import { NextResponse } from "next/server";
import {
  isPartnerSelfConnectEnabled,
  PartnerOAuthError,
  readClickatonMpOAuthAppConfig,
} from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  createPartnerOAuthRuntime,
  mapPartnerOAuthError,
} from "@/lib/admin/mp-partner-oauth/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/dnx-payments/partner/mercadopago/connect
 * Partner self-connect — User from session only (never from query).
 */
export async function GET(request: Request) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!isPartnerSelfConnectEnabled()) {
    return NextResponse.json(
      { ok: false, error: "PARTNER_SELF_CONNECT_DISABLED" },
      { status: 403 },
    );
  }

  const app = readClickatonMpOAuthAppConfig();
  if (!app.configured) {
    return NextResponse.json(
      { ok: false, error: "APP_NOT_CONFIGURED", missing: app.missing },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const wantsJson = url.searchParams.get("format") === "json";

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable, redirectUri, environment } =
      createPartnerOAuthRuntime();
    if (!vaultAvailable) {
      return NextResponse.json(
        { ok: false, error: "VAULT_UNAVAILABLE" },
        { status: 503 },
      );
    }

    const started = await service.startConnect({ actor, redirectUri });

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        authorizeUrl: started.authorizeUrl,
        stateId: started.stateId,
        expiresAt: started.expiresAt,
        environment,
        flowType: "PARTNER",
      });
    }
    return NextResponse.redirect(started.authorizeUrl, 302);
  } catch (err) {
    if (err instanceof PartnerOAuthError || (err && typeof err === "object" && "code" in err)) {
      const mapped = mapPartnerOAuthError(err);
      return NextResponse.json(
        { ok: false, error: mapped.error, message: mapped.message },
        { status: mapped.status },
      );
    }
    return NextResponse.json({ ok: false, error: "PARTNER_OAUTH_FAILED" }, { status: 500 });
  }
}
