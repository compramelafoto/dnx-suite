/**
 * Runtime binding for Clickatón owner Mercado Pago OAuth.
 * Wires Prisma store + credential vault + MP HTTP client.
 * Never logs tokens. Live exchange only when flags + phrase + secrets are set.
 */
import {
  CLICKATON_MP_REDIRECTS,
  ClickatonOwnerOAuthService,
  CredentialVault,
  canStartLiveOwnerOAuth,
  createLiveClickatonMpOAuthHttpClient,
  createPrismaOwnerOAuthStore,
  isOwnerOAuthManuallyAuthorized,
  loadCredentialVaultKeyConfig,
  type ClickatonMpOAuthHttpClient,
} from "@repo/payments";
import {
  createPrismaCredentialStore,
  type EncryptedCredentialPrismaDelegate,
} from "@repo/payments/infrastructure/prisma";
import { prisma } from "@/lib/admin/db";

export type OwnerOAuthRuntime = {
  service: ClickatonOwnerOAuthService;
  vaultAvailable: boolean;
  redirectUri: string;
};

function resolveRedirectUri(): string {
  const fromEnv = process.env.CLICKATON_MP_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const publicBase = (
    process.env.CLICKATON_PUBLIC_URL ||
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL ||
    process.env.APP_URL ||
    ""
  ).replace(/\/$/, "");
  if (publicBase) {
    return `${publicBase}/api/clickaton/payments/mercadopago/callback`;
  }
  return "https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback";
}

export function isVaultMasterKeyPresent(): boolean {
  try {
    loadCredentialVaultKeyConfig("PROD");
    return true;
  } catch {
    return false;
  }
}

export function createOwnerOAuthRuntime(opts?: {
  mpClient?: ClickatonMpOAuthHttpClient;
}): OwnerOAuthRuntime {
  const store = createPrismaOwnerOAuthStore(prisma);
  // Prisma enum brands (`DnxPaymentProvider`) are narrower than the vault
  // delegate string surface — intentional bridge for runtime wiring.
  const credentialStore = createPrismaCredentialStore(
    prisma as never as EncryptedCredentialPrismaDelegate,
  );
  const vaultAvailable = isVaultMasterKeyPresent();
  const vault = new CredentialVault(credentialStore, () =>
    loadCredentialVaultKeyConfig("PROD"),
  );

  const pkceKey = process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim() || "";

  const service = new ClickatonOwnerOAuthService({
    store,
    vault,
    mpClient: opts?.mpClient ?? createLiveClickatonMpOAuthHttpClient(),
    pkceMasterKeyBase64: pkceKey,
    defaultRedirectUri: resolveRedirectUri(),
  });

  return {
    service,
    vaultAvailable,
    redirectUri: resolveRedirectUri(),
  };
}

export function mapOwnerOAuthError(err: unknown): {
  status: number;
  error: string;
  message: string;
} {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "OWNER_OAUTH_FAILED";
  const message =
    err instanceof Error ? err.message.slice(0, 200) : "Owner OAuth failed";

  const statusByCode: Record<string, number> = {
    FORBIDDEN_NOT_FINANCE_OWNER: 403,
    ONBOARDING_FLAG_OFF: 403,
    OWNER_OAUTH_NOT_AUTHORIZED: 403,
    APP_NOT_CONFIGURED: 503,
    STATE_NOT_FOUND: 400,
    STATE_REPLAY: 409,
    STATE_EXPIRED: 400,
    STATE_USER_MISMATCH: 403,
    STATE_PRODUCT_MISMATCH: 400,
    STATE_PURPOSE_MISMATCH: 400,
    STATE_ENV_MISMATCH: 400,
    ACCOUNT_DUPLICATE: 409,
    OWNER_REPLACEMENT_BLOCKED: 409,
    OWNER_ALREADY_ACTIVE: 409,
    NOT_CONNECTED: 404,
    REAUTH_REQUIRED: 400,
    MASTER_KEY_MISSING: 503,
  };

  return {
    status: statusByCode[code] ?? 500,
    error: code,
    message,
  };
}

export function getOwnerOAuthDiagnostics(): {
  callbackRoute: string;
  exchangeServiceAvailable: boolean;
  vaultAvailable: boolean;
  redirectUri: string;
  redirectExactMatchProduction: boolean;
  mode: "PROD";
  onboardingEnabled: boolean;
  manualAuthorized: boolean;
  canStartLiveOwnerOAuth: boolean;
  appConfigured: boolean;
  lastErrorSanitized: null;
} {
  const appId = Boolean(process.env.CLICKATON_MP_CLIENT_ID?.trim());
  const appSecret = Boolean(process.env.CLICKATON_MP_CLIENT_SECRET?.trim());
  const redirectUri = resolveRedirectUri();
  return {
    callbackRoute: "/api/clickaton/payments/mercadopago/callback",
    exchangeServiceAvailable: true,
    vaultAvailable: isVaultMasterKeyPresent(),
    redirectUri,
    redirectExactMatchProduction: redirectUri === CLICKATON_MP_REDIRECTS.production,
    mode: "PROD",
    onboardingEnabled:
      process.env.DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED === "true" ||
      process.env.DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED === "1" ||
      process.env.DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED === "on",
    manualAuthorized: isOwnerOAuthManuallyAuthorized(),
    canStartLiveOwnerOAuth: canStartLiveOwnerOAuth(),
    appConfigured: appId && appSecret,
    lastErrorSanitized: null,
  };
}
