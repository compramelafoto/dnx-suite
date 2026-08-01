/**
 * Runtime binding for DNX partner Mercado Pago self-connect.
 * Never logs tokens. Never mutates owner ORGANIZATION collector.
 */
import {
  ClickatonPartnerOAuthService,
  CredentialVault,
  createLiveClickatonMpOAuthHttpClient,
  createPrismaPartnerOAuthStore,
  isPartnerSelfConnectEnabled,
  loadCredentialVaultKeyConfig,
  resolvePartnerOAuthEnvironment,
  type ClickatonMpOAuthHttpClient,
} from "@repo/payments";
import {
  createPrismaCredentialStore,
  type EncryptedCredentialPrismaDelegate,
} from "@repo/payments/infrastructure/prisma";
import { prisma } from "@/lib/admin/db";
import { isVaultMasterKeyPresent } from "@/lib/admin/mp-owner-oauth/runtime";

export type PartnerOAuthRuntime = {
  service: ClickatonPartnerOAuthService;
  vaultAvailable: boolean;
  redirectUri: string;
  environment: "TEST" | "PROD";
  featureEnabled: boolean;
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

export function createPartnerOAuthRuntime(opts?: {
  mpClient?: ClickatonMpOAuthHttpClient;
}): PartnerOAuthRuntime {
  const store = createPrismaPartnerOAuthStore(prisma);
  const credentialStore = createPrismaCredentialStore(
    prisma as never as EncryptedCredentialPrismaDelegate,
  );
  const vaultAvailable = isVaultMasterKeyPresent();
  const environment = resolvePartnerOAuthEnvironment();
  const vault = new CredentialVault(credentialStore, () =>
    loadCredentialVaultKeyConfig(environment),
  );
  const pkceKey = process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim() || "";

  const service = new ClickatonPartnerOAuthService({
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
    environment,
    featureEnabled: isPartnerSelfConnectEnabled(),
  };
}

export function mapPartnerOAuthError(err: unknown): {
  status: number;
  error: string;
  message: string;
} {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "PARTNER_OAUTH_FAILED";
  const message =
    err instanceof Error ? err.message.slice(0, 200) : "Partner OAuth failed";

  const statusByCode: Record<string, number> = {
    FORBIDDEN_NOT_PARTNER_CONNECT: 403,
    FORBIDDEN_VIEW_OWN_ACCOUNT: 403,
    PARTNER_SELF_CONNECT_DISABLED: 403,
    APP_NOT_CONFIGURED: 503,
    STATE_NOT_FOUND: 400,
    STATE_REPLAY: 409,
    STATE_EXPIRED: 400,
    STATE_USER_MISMATCH: 403,
    STATE_PURPOSE_MISMATCH: 400,
    STATE_ENV_MISMATCH: 400,
    PAYMENT_ACCOUNT_OWNERSHIP_CONFLICT: 409,
    COLLECTOR_ACCOUNT_REQUIRES_OWNER_RECONNECT: 409,
    PARTNER_ALREADY_ACTIVE: 409,
    NOT_CONNECTED: 404,
    REAUTH_REQUIRED: 400,
    ACCOUNT_IN_ACTIVE_DISTRIBUTION: 409,
    OWNER_ACCOUNT_REGRESSION: 500,
    MASTER_KEY_MISSING: 503,
  };

  return {
    status: statusByCode[code] ?? 500,
    error: code,
    message,
  };
}
