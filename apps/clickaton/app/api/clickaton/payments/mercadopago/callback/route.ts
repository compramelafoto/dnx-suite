import { NextResponse } from "next/server";
import { canStartLiveOwnerOAuth, isOwnerOnboardingEnabled } from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/clickaton/payments/mercadopago/callback
 * Never trusts email / provider id / receiver id from query besides `code` + `state`.
 * Without manual authorization: rejects without exchanging code.
 */
export async function GET(request: Request) {
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
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ ok: false, error: "MISSING_CODE_OR_STATE" }, { status: 400 });
  }

  // Domain callback completion is implemented in @repo/payments
  // ClickatonOwnerOAuthService.completeCallback (tested with mocks).
  // HTTP wiring to Prisma store + vault master key is activated only after
  // staging migration + dedicated app credentials + manual phrase.
  return NextResponse.json({
    ok: false,
    error: "CALLBACK_SERVICE_PENDING_RUNTIME_BINDING",
    message:
      "Code/state received shape OK. Exchange is disabled until Prisma OAuth store + vault env are bound in a controlled window. No token was stored.",
  });
}
