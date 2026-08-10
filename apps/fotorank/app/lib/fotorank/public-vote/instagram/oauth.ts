/**
 * ETAPA 17B — OAuth Instagram (Facebook Login → IG Graph). Mock exchange en E2E.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mockTokenReference, sealToken } from "./token-vault";

const OAUTH_SECRET =
  process.env.FOTORANK_OAUTH_STATE_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "fotorank-oauth-dev-secret";

type PendingOAuth = {
  organizationId: string;
  userId: number;
  createdAt: number;
};

const pendingStates = new Map<string, PendingOAuth>();

export function createOAuthState(input: { organizationId: string; userId: number }): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${input.organizationId}:${input.userId}:${nonce}:${Date.now()}`;
  const sig = createHmac("sha256", OAUTH_SECRET).update(payload).digest("hex");
  const state = Buffer.from(`${payload}:${sig}`).toString("base64url");
  pendingStates.set(state, { ...input, createdAt: Date.now() });
  return state;
}

export function consumeOAuthState(state: string): PendingOAuth | null {
  const entry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 15 * 60_000) return null;

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", OAUTH_SECRET).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return entry;
}

export function buildInstagramAuthorizeUrl(input: {
  state: string;
  redirectUri: string;
  appId?: string;
}): string {
  const appId = input.appId ?? process.env.META_APP_ID ?? "mock-meta-app";
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope:
      "instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement",
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export function assertRedirectUriAllowed(uri: string): void {
  const allow = (process.env.FOTORANK_INSTAGRAM_REDIRECT_URI_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) {
    // Dev / Production sin allowlist explícita: permitir localhost y paths de callback conocidos.
    if (
      uri.includes("localhost") ||
      uri.includes("/api/fotorank/instagram/oauth/callback") ||
      uri.includes("mock")
    ) {
      return;
    }
    throw new Error("REDIRECT_URI_ALLOWLIST_EMPTY");
  }
  if (!allow.includes(uri)) {
    throw new Error("REDIRECT_URI_NOT_ALLOWED");
  }
}

export async function exchangeInstagramOAuthCode(input: {
  code: string;
  accountId: string;
  accountUsername: string;
  accountType?: string;
}): Promise<{
  tokenReference: string;
  tokenExpiresAt: Date;
  permissions: Record<string, boolean>;
}> {
  // Nunca loguear input.code
  if (process.env.FOTORANK_INSTAGRAM_MOCK_OAUTH !== "0") {
    const ref = sealToken(mockTokenReference(input.accountId));
    return {
      tokenReference: ref,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60_000),
      permissions: {
        publish: true,
        readMetrics: true,
        insights: true,
        webhooks: false,
      },
    };
  }
  if (process.env.FOTORANK_ALLOW_INSTAGRAM_PROBE !== "1") {
    throw new Error("INSTAGRAM_OAUTH_LIVE_REQUIRES_PROBE_FLAG");
  }
  throw new Error("INSTAGRAM_OAUTH_LIVE_NOT_ENABLED");
}
