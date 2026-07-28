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

const SAFE_SUCCESS_PATH = "/admin/finanzas/cuenta-owner?mp_oauth=connected";
const SAFE_ERROR_PATH = "/admin/finanzas/cuenta-owner?mp_oauth=error";

function safePanelRedirect(base: string, errorCode?: string): string {
  // Open-redirect prevention: only relative admin path.
  if (errorCode) {
    return `${SAFE_ERROR_PATH}&code=${encodeURIComponent(errorCode.slice(0, 64))}`;
  }
  return SAFE_SUCCESS_PATH;
}

/**
 * GET /api/clickaton/payments/mercadopago/callback
 * Validates state, exchanges code once, stores tokens in vault, upserts DnxPaymentAccount.
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
  const wantsJson = url.searchParams.get("format") === "json";

  if (!code || !state) {
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: "MISSING_CODE_OR_STATE" },
        { status: 400 },
      );
    }
    return NextResponse.redirect(new URL(safePanelRedirect("", "MISSING_CODE_OR_STATE"), url.origin));
  }

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable } = createOwnerOAuthRuntime();
    if (!vaultAvailable) {
      const payload = {
        ok: false as const,
        error: "VAULT_UNAVAILABLE",
        message: "Credential vault master key not configured",
      };
      if (wantsJson) return NextResponse.json(payload, { status: 503 });
      return NextResponse.redirect(
        new URL(safePanelRedirect("", "VAULT_UNAVAILABLE"), url.origin),
      );
    }

    const result = await service.completeCallback({
      actor,
      stateToken: state,
      code,
    });

    // Sanitized — never include access/refresh tokens.
    const body = {
      ok: true as const,
      paymentAccountId: result.paymentAccountId,
      status: result.status,
      providerUserIdMasked: result.providerUserIdMasked,
      globalAccount: true,
      note: "DnxPaymentAccount linked to financial identity / User.id — not edition-scoped",
    };

    if (wantsJson) {
      return NextResponse.json(body);
    }
    return NextResponse.redirect(new URL(safePanelRedirect(""), url.origin));
  } catch (err) {
    const mapped =
      err instanceof OwnerOAuthError || (err && typeof err === "object" && "code" in err)
        ? mapOwnerOAuthError(err)
        : { status: 500, error: "OWNER_OAUTH_FAILED", message: "Callback failed" };

    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: mapped.error, message: mapped.message },
        { status: mapped.status },
      );
    }
    return NextResponse.redirect(
      new URL(safePanelRedirect("", mapped.error), url.origin),
    );
  }
}
