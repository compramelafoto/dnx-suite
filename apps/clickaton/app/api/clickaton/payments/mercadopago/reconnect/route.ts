import { NextResponse } from "next/server";
import {
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
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

/** POST /api/clickaton/payments/mercadopago/reconnect */
export async function POST(request: Request) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isOwnerOnboardingEnabled() || !canStartLiveOwnerOAuth()) {
    return NextResponse.json(
      { ok: false, error: "OWNER_OAUTH_NOT_AUTHORIZED" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const wantsJson = url.searchParams.get("format") === "json";

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable, redirectUri } = createOwnerOAuthRuntime();
    if (!vaultAvailable) {
      return NextResponse.json(
        { ok: false, error: "VAULT_UNAVAILABLE" },
        { status: 503 },
      );
    }
    const started = await service.startReconnect({ actor, redirectUri });
    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        authorizeUrl: started.authorizeUrl,
        stateId: started.stateId,
        expiresAt: started.expiresAt,
      });
    }
    return NextResponse.redirect(started.authorizeUrl, 302);
  } catch (err) {
    if (err instanceof OwnerOAuthError || (err && typeof err === "object" && "code" in err)) {
      const mapped = mapOwnerOAuthError(err);
      return NextResponse.json(
        { ok: false, error: mapped.error, message: mapped.message },
        { status: mapped.status },
      );
    }
    return NextResponse.json({ ok: false, error: "OWNER_OAUTH_FAILED" }, { status: 500 });
  }
}
