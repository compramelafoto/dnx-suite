import { NextResponse } from "next/server";
import { isOwnerOnboardingEnabled, OwnerOAuthError } from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  createOwnerOAuthRuntime,
  mapOwnerOAuthError,
} from "@/lib/admin/mp-owner-oauth/runtime";

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

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable } = createOwnerOAuthRuntime();
    if (!vaultAvailable) {
      return NextResponse.json(
        { ok: false, error: "VAULT_UNAVAILABLE" },
        { status: 503 },
      );
    }
    const result = await service.revoke({
      actor,
      reinforcedConfirm: true,
    });
    return NextResponse.json({
      ok: true,
      status: result.status,
    });
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
