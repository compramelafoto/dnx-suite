import { NextResponse } from "next/server";
import {
  canStartLiveOwnerOAuth,
  hashOAuthStateToken,
  isOwnerOnboardingEnabled,
  isPartnerOAuthPurpose,
  isPartnerSelfConnectEnabled,
  OwnerOAuthError,
  PartnerOAuthError,
} from "@repo/payments";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  createOwnerOAuthRuntime,
  mapOwnerOAuthError,
} from "@/lib/admin/mp-owner-oauth/runtime";
import {
  createPartnerOAuthRuntime,
  mapPartnerOAuthError,
} from "@/lib/admin/mp-partner-oauth/runtime";
import { prisma } from "@/lib/admin/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OWNER_SUCCESS = "/admin/finanzas/cuenta-owner?mp_oauth=connected";
const OWNER_ERROR = "/admin/finanzas/cuenta-owner?mp_oauth=error";
const PARTNER_SUCCESS = "/admin/finanzas/mi-cuenta?mp_oauth=connected";
const PARTNER_ERROR = "/admin/finanzas/mi-cuenta?mp_oauth=error";

function redirectPath(
  flow: "OWNER" | "PARTNER",
  errorCode?: string,
): string {
  const base = flow === "PARTNER" ? PARTNER_ERROR : OWNER_ERROR;
  const ok = flow === "PARTNER" ? PARTNER_SUCCESS : OWNER_SUCCESS;
  if (errorCode) {
    return `${base}&code=${encodeURIComponent(errorCode.slice(0, 64))}`;
  }
  return ok;
}

async function peekOAuthPurpose(
  stateToken: string,
): Promise<"OWNER" | "PARTNER" | "UNKNOWN"> {
  const stateHash = hashOAuthStateToken(stateToken);
  const row = await prisma.dnxMercadoPagoOAuthState.findUnique({
    where: { stateHash },
    select: { purpose: true },
  });
  if (!row) return "UNKNOWN";
  if (isPartnerOAuthPurpose(row.purpose)) return "PARTNER";
  if (row.purpose === "OWNER_CONNECTION" || row.purpose === "OWNER_RECONNECT") {
    return "OWNER";
  }
  return "UNKNOWN";
}

/**
 * GET /api/clickaton/payments/mercadopago/callback
 * Shared MP redirect — branches OWNER vs PARTNER by OAuth state purpose.
 */
export async function GET(request: Request) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
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
    return NextResponse.redirect(
      new URL(redirectPath("OWNER", "MISSING_CODE_OR_STATE"), url.origin),
    );
  }

  const flow = await peekOAuthPurpose(state);

  if (flow === "PARTNER") {
    if (!isPartnerSelfConnectEnabled()) {
      const payload = { ok: false as const, error: "PARTNER_SELF_CONNECT_DISABLED" };
      if (wantsJson) return NextResponse.json(payload, { status: 403 });
      return NextResponse.redirect(
        new URL(redirectPath("PARTNER", payload.error), url.origin),
      );
    }
    try {
      const actor = await loadFinanceActor(user.id);
      const { service, vaultAvailable } = createPartnerOAuthRuntime();
      if (!vaultAvailable) {
        if (wantsJson) {
          return NextResponse.json({ ok: false, error: "VAULT_UNAVAILABLE" }, { status: 503 });
        }
        return NextResponse.redirect(
          new URL(redirectPath("PARTNER", "VAULT_UNAVAILABLE"), url.origin),
        );
      }
      const result = await service.completeCallback({
        actor,
        stateToken: state,
        code,
      });
      const body = {
        ok: true as const,
        flowType: "PARTNER" as const,
        paymentAccountId: result.paymentAccountId,
        status: result.status,
        providerUserIdMasked: result.providerUserIdMasked,
      };
      if (wantsJson) return NextResponse.json(body);
      return NextResponse.redirect(new URL(redirectPath("PARTNER"), url.origin));
    } catch (err) {
      const mapped =
        err instanceof PartnerOAuthError ||
        (err && typeof err === "object" && "code" in err)
          ? mapPartnerOAuthError(err)
          : { status: 500, error: "PARTNER_OAUTH_FAILED", message: "Callback failed" };
      if (wantsJson) {
        return NextResponse.json(
          { ok: false, error: mapped.error, message: mapped.message },
          { status: mapped.status },
        );
      }
      return NextResponse.redirect(
        new URL(redirectPath("PARTNER", mapped.error), url.origin),
      );
    }
  }

  if (flow !== "OWNER") {
    if (wantsJson) {
      return NextResponse.json({ ok: false, error: "STATE_NOT_FOUND" }, { status: 400 });
    }
    return NextResponse.redirect(
      new URL(redirectPath("OWNER", "STATE_NOT_FOUND"), url.origin),
    );
  }

  if (!isOwnerOnboardingEnabled() || !canStartLiveOwnerOAuth()) {
    return NextResponse.json(
      { ok: false, error: "OWNER_OAUTH_NOT_AUTHORIZED" },
      { status: 403 },
    );
  }

  try {
    const actor = await loadFinanceActor(user.id);
    const { service, vaultAvailable } = createOwnerOAuthRuntime();
    if (!vaultAvailable) {
      if (wantsJson) {
        return NextResponse.json({ ok: false, error: "VAULT_UNAVAILABLE" }, { status: 503 });
      }
      return NextResponse.redirect(
        new URL(redirectPath("OWNER", "VAULT_UNAVAILABLE"), url.origin),
      );
    }

    const result = await service.completeCallback({
      actor,
      stateToken: state,
      code,
    });

    const body = {
      ok: true as const,
      flowType: "OWNER" as const,
      paymentAccountId: result.paymentAccountId,
      status: result.status,
      providerUserIdMasked: result.providerUserIdMasked,
      globalAccount: true,
      note: "DnxPaymentAccount linked to financial identity / User.id — not edition-scoped",
    };

    if (wantsJson) return NextResponse.json(body);
    return NextResponse.redirect(new URL(redirectPath("OWNER"), url.origin));
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
      new URL(redirectPath("OWNER", mapped.error), url.origin),
    );
  }
}
