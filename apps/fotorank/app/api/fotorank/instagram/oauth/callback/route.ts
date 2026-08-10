/**
 * ETAPA 17B — OAuth callback Instagram.
 * NO ejecuta exchange live sin flags. No loguea tokens/code.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  assertRedirectUriAllowed,
  consumeOAuthState,
  exchangeInstagramOAuthCode,
} from "../../../../../lib/fotorank/public-vote/instagram/oauth";
import { scrubSecrets } from "../../../../../lib/fotorank/public-vote/instagram/token-vault";
import { upsertMockSocialConnection } from "../../../../../lib/fotorank/public-vote/instagram/social-connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(query: Record<string, string>) {
  const u = new URL("/dashboard/settings/redes-sociales", process.env.NEXTAUTH_URL ?? "https://fotorank.com");
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return NextResponse.redirect(u);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Nunca loguear code/token
  void scrubSecrets({ hasCode: Boolean(code), hasState: Boolean(state), error });

  if (error) {
    return settingsRedirect({ ig_oauth: "denied", reason: error.slice(0, 64) });
  }
  if (!state || !code) {
    return settingsRedirect({ ig_oauth: "invalid", reason: "missing_params" });
  }

  const pending = consumeOAuthState(state);
  if (!pending) {
    return settingsRedirect({ ig_oauth: "invalid", reason: "state" });
  }

  const redirectUri =
    process.env.FOTORANK_INSTAGRAM_OAUTH_REDIRECT ??
    `${url.origin}/api/fotorank/instagram/oauth/callback`;

  try {
    assertRedirectUriAllowed(redirectUri);
  } catch {
    return settingsRedirect({ ig_oauth: "invalid", reason: "redirect" });
  }

  // Live Meta exchange solo con probe explícito — Production comercial OFF.
  const liveAllowed =
    process.env.FOTORANK_ALLOW_INSTAGRAM_PROBE === "1" &&
    process.env.FOTORANK_INSTAGRAM_MOCK_OAUTH === "0";

  if (!liveAllowed) {
    // Runtime preparado: valida state y redirige. No persiste connection real desde callback sin probe.
    return settingsRedirect({ ig_oauth: "prepared", reason: "mock_or_probe_required" });
  }

  try {
    const exchanged = await exchangeInstagramOAuthCode({
      code,
      accountId: `pending_${pending.organizationId.slice(0, 8)}`,
      accountUsername: "pending",
    });
    await upsertMockSocialConnection({
      organizationId: pending.organizationId,
      accountId: `live_${pending.organizationId.slice(0, 8)}`,
      accountUsername: "pending.live",
      connectedByUserId: pending.userId,
      permissions: {
        publish: Boolean(exchanged.permissions.publish),
        readMetrics: Boolean(exchanged.permissions.readMetrics),
        webhooks: false,
        insights: Boolean(exchanged.permissions.insights),
      },
    });
    return settingsRedirect({ ig_oauth: "ok" });
  } catch {
    return settingsRedirect({ ig_oauth: "error", reason: "exchange" });
  }
}
