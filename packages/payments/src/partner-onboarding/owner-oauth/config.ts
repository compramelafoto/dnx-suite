/**
 * Clickatón dedicated Mercado Pago OAuth / owner onboarding config (10D3I-I1).
 * Secrets never logged. Real OAuth requires explicit manual authorization phrase.
 */

export const OWNER_ONBOARDING_FLAG = "DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED" as const;
export const OWNER_OAUTH_MANUAL_AUTH_FLAG =
  "DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED" as const;
export const OWNER_OAUTH_MANUAL_AUTH_PHRASE_ENV =
  "DNX_CLICKATON_MP_OWNER_OAUTH_AUTHORIZATION_PHRASE" as const;

/** Exact phrase Daniel must confirm before any live OAuth exchange. */
export const OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE =
  "AUTORIZO CONECTAR LA CUENTA OWNER REAL EXCLUSIVA DE CLICKATÓN" as const;

export const CLICKATON_MP_OWNER_ORG_REF = "clickaton:partners-production:mp-owner" as const;
export const CLICKATON_MP_OWNER_ORIGIN_APP = "clickaton" as const;
export const CLICKATON_MP_OWNER_DEDICATED_MARKER = "dedicatedProduct=clickaton" as const;
export const CLICKATON_MP_OWNER_PURPOSE = "OWNER_CONNECTION" as const;

/** Markers of the dedicated Clickatón collector PaymentAccount (not a partner PERSON PA). */
export function isClickatonOwnerCollectorAccount(account: {
  originApp?: string | null;
  externalReference?: string | null;
  capabilities?: readonly string[] | null;
}): boolean {
  if (account.originApp !== CLICKATON_MP_OWNER_ORIGIN_APP) return false;
  if (account.externalReference !== CLICKATON_MP_OWNER_DEDICATED_MARKER) {
    return false;
  }
  const caps = account.capabilities ?? [];
  // Markers are authoritative; COLLECTOR capability preferred when present.
  return caps.length === 0 || caps.includes("COLLECTOR");
}

export const CLICKATON_MP_OAUTH_ENV = {
  clientId: "CLICKATON_MP_CLIENT_ID",
  clientSecret: "CLICKATON_MP_CLIENT_SECRET",
  redirectUri: "CLICKATON_MP_REDIRECT_URI",
  webhookSecret: "CLICKATON_MP_WEBHOOK_SECRET",
  publicKey: "CLICKATON_MP_PUBLIC_KEY",
  /** "true" = enviar PKCE S256 (requiere el toggle en la app MP Developers). */
  usePkce: "CLICKATON_MP_OAUTH_USE_PKCE",
} as const;

/** Known hosts from repo docs — do not invent others. */
export const CLICKATON_HOSTS = {
  production: "https://maratonfotografica.com",
  stagingVercel: "https://clickaton-staging.vercel.app",
  vercelProjectProduction: "clickaton-dnxsuite",
  vercelProjectStaging: "clickaton-staging",
} as const;

export const CLICKATON_MP_OAUTH_PATHS = {
  connect: "/api/clickaton/payments/mercadopago/connect",
  callback: "/api/clickaton/payments/mercadopago/callback",
  revoke: "/api/clickaton/payments/mercadopago/revoke",
  reconnect: "/api/clickaton/payments/mercadopago/reconnect",
  panel: "/admin/finanzas/cuenta-owner",
} as const;

export const CLICKATON_MP_NOTIFICATION_PATH = "/api/webhooks/dnx-payments" as const;

export function clickatonMpRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}${CLICKATON_MP_OAUTH_PATHS.callback}`;
}

export function clickatonMpNotificationUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}${CLICKATON_MP_NOTIFICATION_PATH}`;
}

export const CLICKATON_MP_REDIRECTS = {
  production: clickatonMpRedirectUri(CLICKATON_HOSTS.production),
  staging: clickatonMpRedirectUri(CLICKATON_HOSTS.stagingVercel),
} as const;

export const CLICKATON_MP_NOTIFICATION_URLS = {
  production: clickatonMpNotificationUri(CLICKATON_HOSTS.production),
  staging: clickatonMpNotificationUri(CLICKATON_HOSTS.stagingVercel),
} as const;

/**
 * Mercado Pago Connect authorize historically does not take OAuth2 `scope`
 * query params the same way as Google. Documented intent for the dedicated app:
 * offline access (refresh) + read user identity. Write/payments only if Orders
 * create requires partner-delegated credentials (owner typically uses app token
 * + receivers — write optional).
 */
export const CLICKATON_MP_OWNER_SCOPES_DOCUMENTED = {
  requestedIntent: ["offline_access", "read"] as const,
  optionalIfOrdersNeedsDelegatedWrite: ["write", "payments"] as const,
  /** Actual authorize URL params used by MP Connect today. */
  authorizeUrlParams: ["client_id", "response_type", "platform_id", "state", "redirect_uri"] as const,
  pkce: "sent_when_enabled_s256_may_be_ignored_by_mp_classic_connect",
} as const;

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function isTruthyFlag(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isOwnerOnboardingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthyFlag(env[OWNER_ONBOARDING_FLAG]);
}

/**
 * Live OAuth start/callback exchange requires BOTH onboarding flag AND the
 * exact manual authorization phrase mirrored in env (never auto-opened).
 */
export function isOwnerOAuthManuallyAuthorized(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isTruthyFlag(env[OWNER_OAUTH_MANUAL_AUTH_FLAG])) return false;
  return (
    (env[OWNER_OAUTH_MANUAL_AUTH_PHRASE_ENV] ?? "").trim() ===
    OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE
  );
}

export function canStartLiveOwnerOAuth(env: NodeJS.ProcessEnv = process.env): boolean {
  return isOwnerOnboardingEnabled(env) && isOwnerOAuthManuallyAuthorized(env);
}

/**
 * PKCE en authorize URL. Default ON (compat tests / apps con toggle PKCE).
 * Setear `CLICKATON_MP_OAUTH_USE_PKCE=false` si la app MP no tiene PKCE habilitado
 * (error MP: "La aplicación no está preparada para conectarse").
 */
export function isClickatonMpOAuthPkceEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[CLICKATON_MP_OAUTH_ENV.usePkce];
  if (raw === undefined || raw.trim() === "") return true;
  return isTruthyFlag(raw);
}

export function readClickatonMpOAuthAppConfig(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  missing: string[];
  redirectUri: string | null;
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
} {
  const missing: string[] = [];
  if (!env[CLICKATON_MP_OAUTH_ENV.clientId]?.trim()) {
    missing.push(CLICKATON_MP_OAUTH_ENV.clientId);
  }
  if (!env[CLICKATON_MP_OAUTH_ENV.clientSecret]?.trim()) {
    missing.push(CLICKATON_MP_OAUTH_ENV.clientSecret);
  }
  const redirectUri =
    env[CLICKATON_MP_OAUTH_ENV.redirectUri]?.trim() ||
    null;
  if (!redirectUri) missing.push(CLICKATON_MP_OAUTH_ENV.redirectUri);
  return {
    configured: missing.length === 0,
    missing,
    redirectUri,
    clientIdPresent: Boolean(env[CLICKATON_MP_OAUTH_ENV.clientId]?.trim()),
    clientSecretPresent: Boolean(env[CLICKATON_MP_OAUTH_ENV.clientSecret]?.trim()),
  };
}
