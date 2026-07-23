import { NextResponse } from "next/server";
import { canStartLiveOwnerOAuth, isOwnerOnboardingEnabled } from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/clickaton/payments/mercadopago/reconnect */
export async function POST() {
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
  return NextResponse.json({
    ok: false,
    error: "RECONNECT_SERVICE_PENDING_RUNTIME_BINDING",
    message:
      "Reconnect uses OWNER_RECONNECT purpose; substitution of a different MP account remains blocked.",
  });
}
