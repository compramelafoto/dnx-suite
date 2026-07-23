import { NextResponse } from "next/server";
import { isOwnerOnboardingEnabled } from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/clickaton/payments/mercadopago/revoke */
export async function POST(request: Request) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isOwnerOnboardingEnabled()) {
    return NextResponse.json({ ok: false, error: "ONBOARDING_FLAG_OFF" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    reinforcedConfirm?: boolean;
  };
  if (!body.reinforcedConfirm) {
    return NextResponse.json({ ok: false, error: "REAUTH_REQUIRED" }, { status: 400 });
  }
  return NextResponse.json({
    ok: false,
    error: "REVOKE_SERVICE_PENDING_RUNTIME_BINDING",
    message: "Revoke domain logic is implemented and tested; runtime Prisma binding pending.",
  });
}
