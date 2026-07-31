import { randomUUID } from "node:crypto";
import {
  CredentialVault,
  fingerprintAccessToken,
  type CredentialRecordStore,
} from "../../credential-vault/vault.js";
import { UNIT_TEST_MASTER_KEY_BASE64 } from "../../credential-vault/keys.js";
import type { FinanceActor } from "../../finance-permissions/types.js";
import {
  canConnectOwnMpAccount,
  canPerformFinanceAction,
} from "../../finance-permissions/check.js";
import type { PartnerPaymentConnectionStatus } from "../connection-states.js";
import {
  OAUTH_STATE_TTL_MS,
  isClickatonMpOAuthPkceEnabled,
  readClickatonMpOAuthAppConfig,
} from "../owner-oauth/config.js";
import {
  buildClickatonMpAuthorizeUrl,
  type ClickatonMpOAuthHttpClient,
} from "../owner-oauth/mp-client.js";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthStateToken,
  hashOAuthStateToken,
} from "../owner-oauth/pkce.js";
import {
  PARTNER_MP_EXTERNAL_REF,
  PARTNER_MP_ORIGIN_APP,
  PARTNER_MP_VAULT_ORIGIN,
  PARTNER_OAUTH_PURPOSES,
  isPartnerOAuthPurpose,
  isPartnerSelfConnectEnabled,
  resolvePartnerOAuthEnvironment,
  type PartnerOAuthPurpose,
} from "./config.js";
import {
  assertOwnerAccountUnchanged,
  snapshotFromAccount,
} from "./invariants.js";
import {
  decryptPkceVerifier,
  encryptPkceVerifier,
  maskAccountLabel,
  type PartnerOAuthStore,
} from "./store.js";
import {
  PartnerOAuthError,
  type PartnerPanelViewModel,
  type PartnerPaymentAccountRecord,
} from "./types.js";

export type PartnerOAuthServiceDeps = {
  store: PartnerOAuthStore;
  vault: CredentialVault;
  mpClient: ClickatonMpOAuthHttpClient;
  pkceMasterKeyBase64: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  clientId?: string;
  clientSecret?: string;
  defaultRedirectUri?: string;
};

function mapAccountToConnectionStatus(
  account: PartnerPaymentAccountRecord | null,
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

export class ClickatonPartnerOAuthService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;

  constructor(private readonly deps: PartnerOAuthServiceDeps) {
    this.env = deps.env ?? process.env;
    this.now = deps.now ?? (() => new Date());
  }

  assertPartnerConnect(actor: FinanceActor): void {
    if (!canConnectOwnMpAccount(actor)) {
      throw new PartnerOAuthError(
        "FORBIDDEN_NOT_PARTNER_CONNECT",
        "DNX_FINANCE_PARTNER_CONNECT (or suite owner) required",
      );
    }
  }

  assertCanViewOwn(actor: FinanceActor): void {
    if (
      canConnectOwnMpAccount(actor) ||
      canPerformFinanceAction(actor, "view_own_mp_account", {
        productKey: "clickaton",
      })
    ) {
      return;
    }
    throw new PartnerOAuthError(
      "FORBIDDEN_VIEW_OWN_ACCOUNT",
      "Partner connect or finance viewer required",
    );
  }

  async getPanelView(actor: FinanceActor): Promise<PartnerPanelViewModel> {
    this.assertCanViewOwn(actor);
    const env = resolvePartnerOAuthEnvironment(this.env);
    const app = readClickatonMpOAuthAppConfig(this.env);
    const featureEnabled = isPartnerSelfConnectEnabled(this.env);
    const canMutate = canConnectOwnMpAccount(actor);

    const identity = canMutate
      ? await this.deps.store.getOrCreatePersonIdentity({
          ownerUserId: actor.userId,
        })
      : null;

    const account = identity
      ? await this.deps.store.findPartnerPaymentAccount({
          financialIdentityId: identity.id,
          environment: env,
        })
      : null;

    const status = mapAccountToConnectionStatus(account);
    const messages: string[] = [];
    if (!featureEnabled) {
      messages.push("La conexión de partner está deshabilitada en este entorno");
    }
    if (status === "NOT_CONNECTED") {
      messages.push("Todavía no conectaste tu Mercado Pago");
    }
    if (status === "ACTIVE") {
      messages.push("Tu cuenta de cobro está activa");
    }
    if (status === "EXPIRED") {
      messages.push("Debés volver a conectar tu Mercado Pago");
    }
    if (status === "REVOKED") {
      messages.push("Tu cuenta fue desconectada");
    }
    messages.push("Esta conexión no modifica la cuenta owner de la plataforma");
    messages.push("Conectar no asigna porcentajes automáticamente");

    return {
      status,
      environment: account?.environment ?? env,
      accountMasked: maskAccountLabel(account?.providerUserId ?? null),
      connectedAt: account?.connectedAt?.toISOString() ?? null,
      health:
        account?.status === "ACTIVE"
          ? "ok"
          : account?.status === "REVOKED"
            ? "revoked"
            : account
              ? "degraded"
              : "unknown",
      messages,
      canConnect:
        canMutate &&
        featureEnabled &&
        (status === "NOT_CONNECTED" || status === "ERROR" || status === "REVOKED"),
      canReconnect:
        canMutate &&
        featureEnabled &&
        (status === "EXPIRED" || status === "ACTIVE" || status === "REVOKED"),
      canRevoke:
        canMutate &&
        (status === "ACTIVE" ||
          status === "VERIFIED" ||
          status === "CONNECTED_UNVERIFIED"),
      featureEnabled,
      appConfigured: app.configured,
      financialIdentityId: identity?.id ?? null,
      paymentAccountId: account?.id ?? null,
    };
  }

  async startConnect(input: {
    actor: FinanceActor;
    purpose?: PartnerOAuthPurpose;
    redirectUri?: string;
  }): Promise<{ authorizeUrl: string; stateId: string; expiresAt: string }> {
    this.assertPartnerConnect(input.actor);
    if (!isPartnerSelfConnectEnabled(this.env)) {
      throw new PartnerOAuthError(
        "PARTNER_SELF_CONNECT_DISABLED",
        "Partner self-connect feature flag is OFF",
      );
    }

    const app = readClickatonMpOAuthAppConfig(this.env);
    const clientId = this.deps.clientId ?? this.env.CLICKATON_MP_CLIENT_ID;
    const redirectUri =
      input.redirectUri ?? this.deps.defaultRedirectUri ?? app.redirectUri;
    if (!clientId?.trim() || !redirectUri?.trim()) {
      throw new PartnerOAuthError(
        "APP_NOT_CONFIGURED",
        "MP OAuth app incomplete",
      );
    }

    const environment = resolvePartnerOAuthEnvironment(this.env);
    const identity = await this.deps.store.getOrCreatePersonIdentity({
      ownerUserId: input.actor.userId,
    });

    if (identity.organizationRef) {
      throw new PartnerOAuthError(
        "PARTNER_IDENTITY_INVALID",
        "Partner connect requires PERSON identity without organizationRef",
      );
    }

    const existing = await this.deps.store.findPartnerPaymentAccount({
      financialIdentityId: identity.id,
      environment,
    });
    const purpose = input.purpose ?? PARTNER_OAUTH_PURPOSES.connection;
    if (
      existing?.status === "ACTIVE" &&
      purpose !== PARTNER_OAUTH_PURPOSES.reconnect
    ) {
      throw new PartnerOAuthError(
        "PARTNER_ALREADY_ACTIVE",
        "Partner already ACTIVE — use reconnect",
      );
    }

    const ownerBefore = await this.deps.store.getOwnerCollectorSnapshot();

    const stateToken = generateOAuthStateToken();
    const stateHash = hashOAuthStateToken(stateToken);
    const usePkce = isClickatonMpOAuthPkceEnabled(this.env);
    let challenge: string | null = null;
    let enc: { ciphertext: string; nonce: string; authTag: string } | null = null;
    if (usePkce) {
      const verifier = generateCodeVerifier();
      challenge = codeChallengeS256(verifier);
      enc = encryptPkceVerifier(verifier, this.deps.pkceMasterKeyBase64);
    }

    const now = this.now();
    const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
    const row = await this.deps.store.saveState({
      id: `oas_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      stateHash,
      userId: input.actor.userId,
      financialIdentityId: identity.id,
      productKey: "dnx",
      purpose,
      environment,
      redirectUri,
      codeChallenge: challenge,
      codeVerifierCiphertext: enc?.ciphertext ?? null,
      codeVerifierNonce: enc?.nonce ?? null,
      codeVerifierAuthTag: enc?.authTag ?? null,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    await this.deps.store.appendAudit({
      action: "PARTNER_OAUTH_STARTED",
      aggregateType: "DnxMercadoPagoOAuthState",
      aggregateId: row.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      metadata: {
        purpose,
        flowType: "PARTNER",
        environment,
        financialIdentityId: identity.id,
        ownerSnapshotId: ownerBefore?.id ?? null,
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
    this.assertPartnerConnect(input.actor);
    if (!isPartnerSelfConnectEnabled(this.env)) {
      throw new PartnerOAuthError(
        "PARTNER_SELF_CONNECT_DISABLED",
        "Partner self-connect feature flag is OFF",
      );
    }

    const ownerBefore = await this.deps.store.getOwnerCollectorSnapshot();
    const stateHash = hashOAuthStateToken(input.stateToken);
    const row = await this.deps.store.getStateByHash(stateHash);
    const now = this.now();
    const environment = resolvePartnerOAuthEnvironment(this.env);

    await this.deps.store.appendAudit({
      action: "PARTNER_OAUTH_CALLBACK_RECEIVED",
      aggregateType: "DnxMercadoPagoOAuthState",
      aggregateId: row?.id ?? "unknown",
      actorUserId: input.actor.userId,
      result: row ? "SUCCEEDED" : "FAILED",
      errorCode: row ? undefined : "STATE_NOT_FOUND",
      createdAt: now,
    });

    if (!row) {
      throw new PartnerOAuthError("STATE_NOT_FOUND", "OAuth state not found");
    }
    if (!isPartnerOAuthPurpose(row.purpose)) {
      throw new PartnerOAuthError(
        "STATE_PURPOSE_MISMATCH",
        "OAuth state is not a partner flow",
      );
    }
    if (row.usedAt) {
      const existingAfterReplay = await this.deps.store.findPartnerPaymentAccount({
        financialIdentityId: row.financialIdentityId,
        environment: row.environment,
      });
      if (
        existingAfterReplay &&
        (existingAfterReplay.status === "ACTIVE" ||
          existingAfterReplay.status === "PENDING") &&
        existingAfterReplay.credentialReference
      ) {
        const ownerAfter = await this.deps.store.getOwnerCollectorSnapshot();
        assertOwnerAccountUnchanged(ownerBefore, ownerAfter);
        return {
          paymentAccountId: existingAfterReplay.id,
          status: mapAccountToConnectionStatus(existingAfterReplay),
          providerUserIdMasked:
            maskAccountLabel(existingAfterReplay.providerUserId) ?? "••••",
        };
      }
      throw new PartnerOAuthError("STATE_REPLAY", "OAuth state already used");
    }
    if (row.expiresAt.getTime() < now.getTime()) {
      throw new PartnerOAuthError("STATE_EXPIRED", "OAuth state expired");
    }
    if (row.userId !== input.actor.userId) {
      throw new PartnerOAuthError("STATE_USER_MISMATCH", "OAuth state user mismatch");
    }
    if (row.environment !== environment) {
      throw new PartnerOAuthError(
        "STATE_ENV_MISMATCH",
        "OAuth state LIVE/TEST mismatch",
      );
    }

    const clientId = this.deps.clientId ?? this.env.CLICKATON_MP_CLIENT_ID;
    const clientSecret = this.deps.clientSecret ?? this.env.CLICKATON_MP_CLIENT_SECRET;
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new PartnerOAuthError("APP_NOT_CONFIGURED", "MP OAuth app incomplete");
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
      throw new PartnerOAuthError(
        "PROVIDER_ID_MISMATCH",
        "Token user_id does not match /users/me",
      );
    }

    const duplicate = await this.deps.store.findPaymentAccountByProviderUser({
      providerUserId: me.providerUserId,
      environment: row.environment,
    });
    if (
      duplicate &&
      duplicate.financialIdentityId !== row.financialIdentityId &&
      duplicate.status !== "REVOKED" &&
      duplicate.status !== "DISABLED"
    ) {
      throw new PartnerOAuthError(
        "PAYMENT_ACCOUNT_OWNERSHIP_CONFLICT",
        "Provider account already bound to another user/identity",
      );
    }

    const existingPartner = await this.deps.store.findPartnerPaymentAccount({
      financialIdentityId: row.financialIdentityId,
      environment: row.environment,
    });
    if (
      existingPartner?.providerUserId &&
      existingPartner.providerUserId !== me.providerUserId &&
      existingPartner.status === "ACTIVE" &&
      row.purpose !== PARTNER_OAUTH_PURPOSES.reconnect
    ) {
      throw new PartnerOAuthError(
        "PAYMENT_ACCOUNT_OWNERSHIP_CONFLICT",
        "Different provider account requires reconnect flow",
      );
    }

    await this.deps.store.markStateUsed(row.id, now);

    const scopes = tokens.scope
      ? tokens.scope.split(/[,\s]+/).filter(Boolean)
      : [];
    const credential = await this.deps.vault.encryptMercadoPagoCredential({
      environment: row.environment,
      payload: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        providerUserId: me.providerUserId,
        connectedAt: now.toISOString(),
        origin: PARTNER_MP_VAULT_ORIGIN,
        scopes,
        expiresAt:
          tokens.expiresIn != null
            ? new Date(now.getTime() + tokens.expiresIn * 1000).toISOString()
            : null,
      },
    });

    if (existingPartner?.credentialReference) {
      try {
        await this.deps.vault.revoke(existingPartner.credentialReference);
      } catch {
        // best-effort
      }
    }

    const accountId =
      existingPartner?.id ?? `pa_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const account: PartnerPaymentAccountRecord = {
      id: accountId,
      financialIdentityId: row.financialIdentityId,
      provider: "MERCADOPAGO",
      environment: row.environment,
      providerUserId: me.providerUserId,
      credentialReference: credential.id,
      originApp: PARTNER_MP_ORIGIN_APP,
      externalReference: PARTNER_MP_EXTERNAL_REF,
      tokenFingerprint: fingerprintAccessToken(tokens.accessToken),
      capabilities: ["SPLIT_RECEIVER", "PAYOUT_DESTINATION"],
      status: "ACTIVE",
      connectedAt: now,
      verifiedAt: now,
      lastHealthCheckAt: now,
      createdAt: existingPartner?.createdAt ?? now,
      updatedAt: now,
    };
    await this.deps.store.upsertPartnerPaymentAccount(account);

    const ownerAfter = await this.deps.store.getOwnerCollectorSnapshot();
    assertOwnerAccountUnchanged(ownerBefore, ownerAfter);

    await this.deps.store.appendAudit({
      action: "PARTNER_ACCOUNT_CONNECTED",
      aggregateType: "DnxPaymentAccount",
      aggregateId: account.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      metadata: {
        flowType: "PARTNER",
        providerUserIdMasked: maskAccountLabel(me.providerUserId),
        ownerUnchanged: true,
        ownerSnapshotId: ownerBefore?.id ?? null,
      },
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
    this.assertPartnerConnect(input.actor);
    if (!input.reinforcedConfirm) {
      throw new PartnerOAuthError(
        "REAUTH_REQUIRED",
        "Reinforced confirmation required",
      );
    }

    const ownerBefore = await this.deps.store.getOwnerCollectorSnapshot();
    const environment = resolvePartnerOAuthEnvironment(this.env);
    const identity = await this.deps.store.getOrCreatePersonIdentity({
      ownerUserId: input.actor.userId,
    });
    const account = await this.deps.store.findPartnerPaymentAccount({
      financialIdentityId: identity.id,
      environment,
    });
    if (!account) {
      throw new PartnerOAuthError("NOT_CONNECTED", "No partner payment account");
    }

    const inUse = await this.deps.store.isPaymentAccountReferencedByActiveDistribution(
      account.id,
    );
    if (inUse) {
      throw new PartnerOAuthError(
        "ACCOUNT_IN_ACTIVE_DISTRIBUTION",
        "Cannot revoke while referenced by an active distribution",
      );
    }

    if (account.credentialReference) {
      await this.deps.vault.revoke(account.credentialReference);
    }
    const now = this.now();
    await this.deps.store.upsertPartnerPaymentAccount({
      ...account,
      status: "REVOKED",
      credentialReference: null,
      updatedAt: now,
    });

    const ownerAfter = await this.deps.store.getOwnerCollectorSnapshot();
    assertOwnerAccountUnchanged(ownerBefore, ownerAfter);

    await this.deps.store.appendAudit({
      action: "PARTNER_ACCOUNT_REVOKED",
      aggregateType: "DnxPaymentAccount",
      aggregateId: account.id,
      actorUserId: input.actor.userId,
      result: "SUCCEEDED",
      metadata: { ownerUnchanged: true },
      createdAt: now,
    });
    return { status: "REVOKED" };
  }

  async startReconnect(input: { actor: FinanceActor; redirectUri?: string }) {
    return this.startConnect({
      actor: input.actor,
      purpose: PARTNER_OAUTH_PURPOSES.reconnect,
      redirectUri: input.redirectUri,
    });
  }
}

export function createTestPartnerOAuthService(input: {
  store: PartnerOAuthStore;
  vaultStore: CredentialRecordStore;
  mpClient: ClickatonMpOAuthHttpClient;
  env?: NodeJS.ProcessEnv;
}): ClickatonPartnerOAuthService {
  return new ClickatonPartnerOAuthService({
    store: input.store,
    vault: new CredentialVault(input.vaultStore, () => ({
      masterKeyBase64: UNIT_TEST_MASTER_KEY_BASE64,
      keyVersion: "test-v1",
      environment: resolvePartnerOAuthEnvironment(input.env),
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

export { snapshotFromAccount };
