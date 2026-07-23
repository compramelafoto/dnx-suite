import { randomUUID } from "node:crypto";
import {
  CredentialVault,
  fingerprintAccessToken,
  type CredentialRecordStore,
} from "../../credential-vault/vault.js";
import { UNIT_TEST_MASTER_KEY_BASE64 } from "../../credential-vault/keys.js";
import type { FinanceActor } from "../../finance-permissions/types.js";
import type { PartnerPaymentConnectionStatus } from "../connection-states.js";
import {
  CLICKATON_MP_OWNER_DEDICATED_MARKER,
  CLICKATON_MP_OWNER_ORG_REF,
  CLICKATON_MP_OWNER_ORIGIN_APP,
  CLICKATON_MP_OWNER_PURPOSE,
  OAUTH_STATE_TTL_MS,
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
  isOwnerOAuthManuallyAuthorized,
  readClickatonMpOAuthAppConfig,
} from "./config.js";
import { buildClickatonMpAuthorizeUrl, type ClickatonMpOAuthHttpClient } from "./mp-client.js";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthStateToken,
  hashOAuthStateToken,
} from "./pkce.js";
import {
  decryptPkceVerifier,
  encryptPkceVerifier,
  maskAccountLabel,
  type OwnerOAuthStore,
} from "./store.js";
import {
  OwnerOAuthError,
  type OwnerOAuthPurpose,
  type OwnerPanelViewModel,
  type OwnerPaymentAccountRecord,
} from "./types.js";

export type OwnerOAuthServiceDeps = {
  store: OwnerOAuthStore;
  vault: CredentialVault;
  mpClient: ClickatonMpOAuthHttpClient;
  /** Base64 32-byte key used to wrap PKCE verifier at rest. */
  pkceMasterKeyBase64: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  clientId?: string;
  clientSecret?: string;
  defaultRedirectUri?: string;
};

function mapAccountToConnectionStatus(
  account: OwnerPaymentAccountRecord | null,
): PartnerPaymentConnectionStatus {
  if (!account) return "NOT_CONNECTED";
  switch (account.status) {
    case "PENDING":
      return account.verifiedAt ? "VERIFIED" : "CONNECTED_UNVERIFIED";
    case "ACTIVE":
      return "ACTIVE";
    case "NEEDS_REAUTH":
      return "EXPIRED";
    case "REVOKED":
      return "REVOKED";
    case "DISABLED":
      return "DISABLED";
    default:
      return "ERROR";
  }
}

export class ClickatonOwnerOAuthService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;

  constructor(private readonly deps: OwnerOAuthServiceDeps) {
    this.env = deps.env ?? process.env;
    this.now = deps.now ?? (() => new Date());
  }

  assertFinanceOwner(actor: FinanceActor): void {
    const hasOwner = actor.grants.some(
      (g) => g.status === "ACTIVE" && g.capability === "DNX_FINANCE_OWNER",
    );
    if (!hasOwner) {
      throw new OwnerOAuthError("FORBIDDEN_NOT_FINANCE_OWNER", "DNX_FINANCE_OWNER required");
    }
  }

  async getPanelView(actor: FinanceActor): Promise<OwnerPanelViewModel> {
    this.assertFinanceOwner(actor);
    const identity = await this.deps.store.getOrCreateOwnerIdentity({
      organizationRef: CLICKATON_MP_OWNER_ORG_REF,
      ownerUserId: actor.userId,
      legalName: "Clickatón — Cuenta Mercado Pago Owner",
    });
    const account = await this.deps.store.findOwnerPaymentAccount({
      financialIdentityId: identity.id,
      environment: "PROD",
    });
    const status = mapAccountToConnectionStatus(account);
    const app = readClickatonMpOAuthAppConfig(this.env);
    const messages: string[] = [];
    if (status === "NOT_CONNECTED") {
      messages.push("Cuenta owner de Clickatón no conectada");
    }
    if (status === "OAUTH_PENDING" || status === "CONNECTED_UNVERIFIED") {
      messages.push("Cuenta conectada y pendiente de verificación");
    }
    if (status === "ACTIVE" || status === "VERIFIED") {
      messages.push("Cuenta owner verificada");
    }
    messages.push("La conexión del owner no activa cobros");
    messages.push("Rodrigo y Tamara todavía deben conectar sus cuentas");
    messages.push("Orders productivo continúa desactivado");
    messages.push("La distribución productiva todavía no está publicada");
    if (!isOwnerOAuthManuallyAuthorized(this.env)) {
      messages.push(
        "OAuth real bloqueado hasta autorización manual explícita de Daniel",
      );
    }

    return {
      status,
      environment: account?.environment ?? null,
      accountMasked: maskAccountLabel(account?.providerUserId ?? null),
      connectedAt: account?.connectedAt?.toISOString() ?? null,
      verifiedAt: account?.verifiedAt?.toISOString() ?? null,
      lastHealthCheckAt: account?.lastHealthCheckAt?.toISOString() ?? null,
      scopes: [],
      health:
        account?.status === "ACTIVE"
          ? "ok"
          : account?.status === "REVOKED"
            ? "revoked"
            : account
              ? "degraded"
              : "unknown",
      messages,
      canConnect: status === "NOT_CONNECTED" || status === "ERROR",
      canReconnect:
        status === "EXPIRED" || status === "REVOKED" || status === "ACTIVE",
      canRevoke: status === "ACTIVE" || status === "VERIFIED" || status === "CONNECTED_UNVERIFIED",
      liveOAuthAuthorized: canStartLiveOwnerOAuth(this.env),
      onboardingFlagEnabled: isOwnerOnboardingEnabled(this.env),
      appConfigured: app.configured,
    };
  }

  /**
   * Starts OAuth. Live authorize URL only when manual phrase + flag + app config.
   * Without manual auth: throws OWNER_OAUTH_NOT_AUTHORIZED (connection NOT executed).
   */
  async startConnect(input: {
    actor: FinanceActor;
    purpose?: OwnerOAuthPurpose;
    redirectUri?: string;
  }): Promise<{ authorizeUrl: string; stateId: string; expiresAt: string }> {
    this.assertFinanceOwner(input.actor);
    if (!isOwnerOnboardingEnabled(this.env)) {
      throw new OwnerOAuthError("ONBOARDING_FLAG_OFF", "owner onboarding flag is OFF");
    }
    if (!isOwnerOAuthManuallyAuthorized(this.env)) {
      throw new OwnerOAuthError(
        "OWNER_OAUTH_NOT_AUTHORIZED",
        "Awaiting exact manual phrase before live OAuth",
      );
    }

    const app = readClickatonMpOAuthAppConfig(this.env);
    const clientId = this.deps.clientId ?? this.env.CLICKATON_MP_CLIENT_ID;
    const redirectUri =
      input.redirectUri ??
      this.deps.defaultRedirectUri ??
      app.redirectUri;
    if (!clientId?.trim() || !redirectUri?.trim()) {
      throw new OwnerOAuthError("APP_NOT_CONFIGURED", "Clickatón MP OAuth app incomplete");
    }

    const identity = await this.deps.store.getOrCreateOwnerIdentity({
      organizationRef: CLICKATON_MP_OWNER_ORG_REF,
      ownerUserId: input.actor.userId,
      legalName: "Clickatón — Cuenta Mercado Pago Owner",
    });

    const existing = await this.deps.store.findOwnerPaymentAccount({
      financialIdentityId: identity.id,
      environment: "PROD",
    });
    if (existing?.status === "ACTIVE" && input.purpose !== "OWNER_RECONNECT") {
      throw new OwnerOAuthError(
        "OWNER_ALREADY_ACTIVE",
        "Owner already ACTIVE — use reconnect or substitution procedure",
      );
    }

    const stateToken = generateOAuthStateToken();
    const stateHash = hashOAuthStateToken(stateToken);
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeS256(verifier);
    const enc = encryptPkceVerifier(verifier, this.deps.pkceMasterKeyBase64);
    const now = this.now();
    const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
    const purpose = input.purpose ?? "OWNER_CONNECTION";

    const row = await this.deps.store.saveState({
      id: `oas_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      stateHash,
      userId: input.actor.userId,
      financialIdentityId: identity.id,
      productKey: "clickaton",
      purpose,
      environment: "PROD",
      redirectUri,
      codeChallenge: challenge,
      codeVerifierCiphertext: enc.ciphertext,
      codeVerifierNonce: enc.nonce,
      codeVerifierAuthTag: enc.authTag,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    await this.deps.store.appendAudit({
      action: "OAUTH_STARTED",
      aggregateType: "DnxMercadoPagoOAuthState",
      aggregateId: row.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      metadata: {
        purpose,
        productKey: "clickaton",
        environment: "PROD",
        financialIdentityId: identity.id,
      },
      createdAt: now,
    });

    const authorizeUrl = buildClickatonMpAuthorizeUrl({
      clientId,
      redirectUri,
      state: stateToken,
      codeChallenge: challenge,
    });

    return {
      authorizeUrl,
      stateId: row.id,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeCallback(input: {
    actor: FinanceActor;
    stateToken: string;
    code: string;
  }): Promise<{
    paymentAccountId: string;
    status: PartnerPaymentConnectionStatus;
    providerUserIdMasked: string;
  }> {
    this.assertFinanceOwner(input.actor);
    if (!canStartLiveOwnerOAuth(this.env)) {
      throw new OwnerOAuthError(
        "OWNER_OAUTH_NOT_AUTHORIZED",
        "Live callback blocked without manual authorization",
      );
    }

    const stateHash = hashOAuthStateToken(input.stateToken);
    const row = await this.deps.store.getStateByHash(stateHash);
    const now = this.now();

    await this.deps.store.appendAudit({
      action: "OAUTH_CALLBACK_RECEIVED",
      aggregateType: "DnxMercadoPagoOAuthState",
      aggregateId: row?.id ?? "unknown",
      actorUserId: input.actor.userId,
      result: row ? "SUCCEEDED" : "FAILED",
      errorCode: row ? undefined : "STATE_NOT_FOUND",
      createdAt: now,
    });

    if (!row) {
      throw new OwnerOAuthError("STATE_NOT_FOUND", "OAuth state not found");
    }
    if (row.usedAt) {
      throw new OwnerOAuthError("STATE_REPLAY", "OAuth state already used");
    }
    if (row.expiresAt.getTime() < now.getTime()) {
      throw new OwnerOAuthError("STATE_EXPIRED", "OAuth state expired");
    }
    if (row.userId !== input.actor.userId) {
      throw new OwnerOAuthError("STATE_USER_MISMATCH", "OAuth state user mismatch");
    }
    if (row.productKey !== "clickaton") {
      throw new OwnerOAuthError("STATE_PRODUCT_MISMATCH", "OAuth state product mismatch");
    }
    if (row.purpose !== "OWNER_CONNECTION" && row.purpose !== "OWNER_RECONNECT") {
      throw new OwnerOAuthError("STATE_PURPOSE_MISMATCH", "OAuth state purpose mismatch");
    }
    if (row.environment !== "PROD") {
      throw new OwnerOAuthError("STATE_ENV_MISMATCH", "OAuth state environment mismatch");
    }

    const clientId = this.deps.clientId ?? this.env.CLICKATON_MP_CLIENT_ID;
    const clientSecret = this.deps.clientSecret ?? this.env.CLICKATON_MP_CLIENT_SECRET;
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new OwnerOAuthError("APP_NOT_CONFIGURED", "Clickatón MP OAuth app incomplete");
    }

    let codeVerifier: string | null = null;
    if (
      row.codeVerifierCiphertext &&
      row.codeVerifierNonce &&
      row.codeVerifierAuthTag
    ) {
      codeVerifier = decryptPkceVerifier(
        {
          ciphertext: row.codeVerifierCiphertext,
          nonce: row.codeVerifierNonce,
          authTag: row.codeVerifierAuthTag,
        },
        this.deps.pkceMasterKeyBase64,
      );
    }

    const tokens = await this.deps.mpClient.exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code: input.code,
      redirectUri: row.redirectUri,
      codeVerifier,
    });

    const me = await this.deps.mpClient.fetchAuthorizedUser(tokens.accessToken);
    if (me.providerUserId !== tokens.providerUserId) {
      throw new OwnerOAuthError(
        "PROVIDER_ID_MISMATCH",
        "Token user_id does not match /users/me",
      );
    }

    const duplicate = await this.deps.store.findPaymentAccountByProviderUser({
      providerUserId: me.providerUserId,
      environment: "PROD",
    });
    if (
      duplicate &&
      duplicate.financialIdentityId !== row.financialIdentityId &&
      duplicate.status !== "REVOKED" &&
      duplicate.status !== "DISABLED"
    ) {
      throw new OwnerOAuthError(
        "ACCOUNT_DUPLICATE",
        "Provider account already bound to another financial identity",
      );
    }

    const existingOwner = await this.deps.store.findOwnerPaymentAccount({
      financialIdentityId: row.financialIdentityId,
      environment: "PROD",
    });

    if (
      existingOwner?.providerUserId &&
      existingOwner.providerUserId !== me.providerUserId &&
      existingOwner.status === "ACTIVE"
    ) {
      throw new OwnerOAuthError(
        "OWNER_REPLACEMENT_BLOCKED",
        "Different provider account requires reinforced substitution procedure",
      );
    }

    await this.deps.store.markStateUsed(row.id, now);

    const scopes = tokens.scope
      ? tokens.scope.split(/[,\s]+/).filter(Boolean)
      : [];
    const connectedAt = now.toISOString();
    const credential = await this.deps.vault.encryptMercadoPagoCredential({
      environment: "PROD",
      payload: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        providerUserId: me.providerUserId,
        connectedAt,
        origin: "clickaton_owner_oauth",
        scopes,
        expiresAt:
          tokens.expiresIn != null
            ? new Date(now.getTime() + tokens.expiresIn * 1000).toISOString()
            : null,
      },
    });

    if (existingOwner?.credentialReference) {
      try {
        await this.deps.vault.revoke(existingOwner.credentialReference);
      } catch {
        // best-effort revoke previous credential
      }
    }

    const accountId = existingOwner?.id ?? `pa_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const account: OwnerPaymentAccountRecord = {
      id: accountId,
      financialIdentityId: row.financialIdentityId,
      provider: "MERCADOPAGO",
      environment: "PROD",
      providerUserId: me.providerUserId,
      credentialReference: credential.id,
      originApp: CLICKATON_MP_OWNER_ORIGIN_APP,
      externalReference: CLICKATON_MP_OWNER_DEDICATED_MARKER,
      tokenFingerprint: fingerprintAccessToken(tokens.accessToken),
      capabilities: ["COLLECTOR"],
      status: "ACTIVE",
      connectedAt: now,
      verifiedAt: now,
      lastHealthCheckAt: now,
      createdAt: existingOwner?.createdAt ?? now,
      updatedAt: now,
    };
    await this.deps.store.upsertOwnerPaymentAccount(account);

    await this.deps.store.appendAudit({
      action: "ACCOUNT_CONNECTED",
      aggregateType: "DnxPaymentAccount",
      aggregateId: account.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      metadata: {
        purpose: CLICKATON_MP_OWNER_PURPOSE,
        providerUserIdMasked: maskAccountLabel(me.providerUserId),
        nicknameMasked: me.nicknameMasked,
        emailMasked: me.emailMasked,
        dedicatedProduct: "clickaton",
      },
      createdAt: now,
    });
    await this.deps.store.appendAudit({
      action: "ACCOUNT_VERIFIED",
      aggregateType: "DnxPaymentAccount",
      aggregateId: account.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      metadata: { health: "ok" },
      createdAt: now,
    });

    return {
      paymentAccountId: account.id,
      status: "ACTIVE",
      providerUserIdMasked: maskAccountLabel(me.providerUserId) ?? "••••",
    };
  }

  async revoke(input: {
    actor: FinanceActor;
    reinforcedConfirm: boolean;
  }): Promise<{ status: PartnerPaymentConnectionStatus }> {
    this.assertFinanceOwner(input.actor);
    if (!input.reinforcedConfirm) {
      throw new OwnerOAuthError("REAUTH_REQUIRED", "Reinforced confirmation required");
    }
    const identity = await this.deps.store.getOrCreateOwnerIdentity({
      organizationRef: CLICKATON_MP_OWNER_ORG_REF,
      ownerUserId: input.actor.userId,
      legalName: "Clickatón — Cuenta Mercado Pago Owner",
    });
    const account = await this.deps.store.findOwnerPaymentAccount({
      financialIdentityId: identity.id,
      environment: "PROD",
    });
    if (!account) {
      throw new OwnerOAuthError("NOT_CONNECTED", "No owner payment account");
    }
    if (account.credentialReference) {
      await this.deps.vault.revoke(account.credentialReference);
    }
    const now = this.now();
    const revoked: OwnerPaymentAccountRecord = {
      ...account,
      status: "REVOKED",
      credentialReference: null,
      updatedAt: now,
    };
    await this.deps.store.upsertOwnerPaymentAccount(revoked);
    await this.deps.store.appendAudit({
      action: "ACCOUNT_REVOKED",
      aggregateType: "DnxPaymentAccount",
      aggregateId: account.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      createdAt: now,
    });
    return { status: "REVOKED" };
  }

  async startReconnect(input: { actor: FinanceActor; redirectUri?: string }) {
    return this.startConnect({
      actor: input.actor,
      purpose: "OWNER_RECONNECT",
      redirectUri: input.redirectUri,
    });
  }
}

export function createTestOwnerOAuthService(input: {
  store: OwnerOAuthStore;
  vaultStore: CredentialRecordStore;
  mpClient: ClickatonMpOAuthHttpClient;
  env?: NodeJS.ProcessEnv;
}): ClickatonOwnerOAuthService {
  return new ClickatonOwnerOAuthService({
    store: input.store,
    vault: new CredentialVault(input.vaultStore, () => ({
      masterKeyBase64: UNIT_TEST_MASTER_KEY_BASE64,
      keyVersion: "test-v1",
      environment: "PROD",
    })),
    mpClient: input.mpClient,
    pkceMasterKeyBase64: UNIT_TEST_MASTER_KEY_BASE64,
    env: input.env,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    defaultRedirectUri:
      "https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback",
  });
}
