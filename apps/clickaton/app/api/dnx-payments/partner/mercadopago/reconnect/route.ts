import { NextResponse } from "next/server";
import { isPartnerSelfConnectEnabled, PartnerOAuthError } from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  createPartnerOAuthRuntime,
  mapPartnerOAuthError,
} from "@/lib/admin/mp-partner-oauth/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
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

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable, redirectUri } = createPartnerOAuthRuntime();
    if (!vaultAvailable) {
      return NextResponse.json({ ok: false, error: "VAULT_UNAVAILABLE" }, { status: 503 });
    }
    const started = await service.startReconnect({ actor, redirectUri });
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json({
        ok: true,
        authorizeUrl: started.authorizeUrl,
        stateId: started.stateId,
        expiresAt: started.expiresAt,
        flowType: "PARTNER",
      });
    }
    return NextResponse.redirect(started.authorizeUrl, 302);
  } catch (err) {
    const mapped = mapPartnerOAuthError(err);
    if (err instanceof PartnerOAuthError || (err && typeof err === "object" && "code" in err)) {
      return NextResponse.json(
        { ok: false, error: mapped.error, message: mapped.message },
        { status: mapped.status },
      );
    }
    return NextResponse.json({ ok: false, error: "PARTNER_OAUTH_FAILED" }, { status: 500 });
  }
}
