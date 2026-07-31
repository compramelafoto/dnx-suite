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

  let reinforcedConfirm = false;
  try {
    const body = (await request.json()) as { reinforcedConfirm?: boolean };
    reinforcedConfirm = Boolean(body.reinforcedConfirm);
  } catch {
    reinforcedConfirm = false;
  }

  try {
    const actor = await loadFinanceActor(user.id);
    const { service } = createPartnerOAuthRuntime();
    const result = await service.revoke({ actor, reinforcedConfirm });
    return NextResponse.json({ ok: true, status: result.status, flowType: "PARTNER" });
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
