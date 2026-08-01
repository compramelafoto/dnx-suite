import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryCredentialStore } from "../../credential-vault/vault.js";
import type { FinanceActor, FinanceGrant } from "../../finance-permissions/types.js";
import {
  CLICKATON_MP_OWNER_DEDICATED_MARKER,
  CLICKATON_MP_OWNER_ORG_REF,
  CLICKATON_MP_REDIRECTS,
} from "../owner-oauth/config.js";
import type { ClickatonMpOAuthHttpClient } from "../owner-oauth/mp-client.js";
import { hashOAuthStateToken } from "../owner-oauth/pkce.js";
import { createTestOwnerOAuthService } from "../owner-oauth/service.js";
import { createMemoryOwnerOAuthStore } from "../owner-oauth/store.js";
import {
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  OWNER_ONBOARDING_FLAG,
  OWNER_OAUTH_MANUAL_AUTH_FLAG,
  OWNER_OAUTH_MANUAL_AUTH_PHRASE_ENV,
} from "../owner-oauth/config.js";
import {
  PARTNER_SELF_CONNECT_FLAG,
  PARTNER_OAUTH_ENVIRONMENT_ENV,
} from "./config.js";
import { createTestPartnerOAuthService } from "./service.js";
import { createMemoryPartnerOAuthStore } from "./store.js";
import { PartnerOAuthError } from "./types.js";

function grant(userId: number, capability: FinanceGrant["capability"]): FinanceGrant {
  return {
    id: `g_${userId}_${capability}`,
    userId,
    capability,
    productKey: capability.startsWith("PRODUCT_") ? "clickaton" : null,
    scopeType: null,
    scopeId: null,
    status: "ACTIVE",
    grantedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function actor(userId: number, grants: FinanceGrant[]): FinanceActor {
  return { userId, grants };
}

function partnerEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [PARTNER_SELF_CONNECT_FLAG]: "true",
    [PARTNER_OAUTH_ENVIRONMENT_ENV]: "TEST",
    CLICKATON_MP_CLIENT_ID: "test-client-id",
    CLICKATON_MP_CLIENT_SECRET: "test-client-secret",
    CLICKATON_MP_REDIRECT_URI: CLICKATON_MP_REDIRECTS.staging,
    CLICKATON_MP_OAUTH_USE_PKCE: "false",
    APP_URL: "https://clickaton-staging.vercel.app",
    ...extra,
  };
}

function ownerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [OWNER_ONBOARDING_FLAG]: "true",
    [OWNER_OAUTH_MANUAL_AUTH_FLAG]: "true",
    [OWNER_OAUTH_MANUAL_AUTH_PHRASE_ENV]: OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
    CLICKATON_MP_CLIENT_ID: "test-client-id",
    CLICKATON_MP_CLIENT_SECRET: "test-client-secret",
    CLICKATON_MP_REDIRECT_URI: CLICKATON_MP_REDIRECTS.staging,
    CLICKATON_MP_OAUTH_USE_PKCE: "false",
  };
}

function mockMp(providerUserId = "44556677"): ClickatonMpOAuthHttpClient {
  return {
    async exchangeAuthorizationCode() {
      return {
        accessToken: "APP_USR-partner-access-token",
        refreshToken: "TG-partner-refresh",
        expiresIn: 3600,
        providerUserId,
        scope: "offline_access read",
      };
    },
    async fetchAuthorizedUser() {
      return {
        providerUserId,
        nicknameMasked: "p***r",
        emailMasked: "p***@t***",
      };
    },
  };
}

async function seedOwnerCollector(
  partnerStore: ReturnType<typeof createMemoryPartnerOAuthStore>,
) {
  const ownerIdentity = await partnerStore.ownerStore.getOrCreateOwnerIdentity({
    organizationRef: CLICKATON_MP_OWNER_ORG_REF,
    ownerUserId: 1,
    legalName: "Owner",
  });
  const now = new Date();
  await partnerStore.ownerStore.upsertOwnerPaymentAccount({
    id: "pa_owner_fixed",
    financialIdentityId: ownerIdentity.id,
    provider: "MERCADOPAGO",
    environment: "PROD",
    providerUserId: "97484805",
    credentialReference: "dnxcred_owner_fixed",
    originApp: "clickaton",
    externalReference: CLICKATON_MP_OWNER_DEDICATED_MARKER,
    tokenFingerprint: "fp_owner",
    capabilities: ["COLLECTOR"],
    status: "ACTIVE",
    connectedAt: now,
    verifiedAt: now,
    lastHealthCheckAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe("10D.2.1 Partner MP self-connect", () => {
  it("1. partner autorizado can connect → ACTIVE + vault (no plaintext)", async () => {
    const store = createMemoryPartnerOAuthStore();
    await seedOwnerCollector(store);
    const vaultStore = createMemoryCredentialStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore,
      mpClient: mockMp("11122233"),
      env: partnerEnv(),
    });
    const partner = actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]);
    const started = await service.startConnect({ actor: partner });
    const stateToken = [...store.ownerStore.states.entries()].find(
      ([, row]) => row.id === started.stateId,
    )?.[0];
    assert.ok(stateToken);
    // reverse: states keyed by hash; recover token by scanning is impossible — extract from authorize URL
    const url = new URL(started.authorizeUrl);
    const token = url.searchParams.get("state");
    assert.ok(token);

    const result = await service.completeCallback({
      actor: partner,
      stateToken: token,
      code: "auth-code",
    });
    assert.equal(result.status, "ACTIVE");
    assert.ok(result.paymentAccountId);
    const account = [...store.ownerStore.accounts.values()].find(
      (a) => a.id === result.paymentAccountId,
    );
    assert.ok(account);
    assert.equal(account.status, "ACTIVE");
    assert.ok(account.credentialReference);
    assert.equal(account.capabilities.includes("SPLIT_RECEIVER"), true);
    assert.notEqual(account.capabilities.includes("COLLECTOR"), true);
    const cred = vaultStore.records.get(account.credentialReference!);
    assert.ok(cred);
    assert.equal(cred.purpose, "mp_oauth_tokens");
    assert.ok(!JSON.stringify(cred).includes("APP_USR-partner-access-token"));
    // owner unchanged
    const owner = await store.getOwnerCollectorSnapshot();
    assert.equal(owner?.id, "pa_owner_fixed");
    assert.equal(owner?.credentialReference, "dnxcred_owner_fixed");
  });

  it("2. viewer without connect → forbidden", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp(),
      env: partnerEnv(),
    });
    const viewer = actor(2, [grant(2, "PRODUCT_FINANCE_VIEWER")]);
    await assert.rejects(
      () => service.startConnect({ actor: viewer }),
      (err: unknown) =>
        err instanceof PartnerOAuthError &&
        err.code === "FORBIDDEN_NOT_PARTNER_CONNECT",
    );
  });

  it("3. user normal → forbidden", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp(),
      env: partnerEnv(),
    });
    await assert.rejects(
      () => service.startConnect({ actor: actor(99, []) }),
      (err: unknown) =>
        err instanceof PartnerOAuthError &&
        err.code === "FORBIDDEN_NOT_PARTNER_CONNECT",
    );
  });

  it("4. owner OAuth still works independently", async () => {
    const ownerStore = createMemoryOwnerOAuthStore();
    const service = createTestOwnerOAuthService({
      store: ownerStore,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("97484805"),
      env: ownerEnv(),
    });
    const owner = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);
    const started = await service.startConnect({ actor: owner });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    const result = await service.completeCallback({
      actor: owner,
      stateToken: token,
      code: "code",
    });
    assert.equal(result.status, "ACTIVE");
  });

  it("5. partner does not overwrite owner collector", async () => {
    const store = createMemoryPartnerOAuthStore();
    await seedOwnerCollector(store);
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("88899900"),
      env: partnerEnv(),
    });
    const partner = actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]);
    const started = await service.startConnect({ actor: partner });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    await service.completeCallback({ actor: partner, stateToken: token, code: "c" });
    const owner = await store.getOwnerCollectorSnapshot();
    assert.equal(owner?.id, "pa_owner_fixed");
    assert.equal(owner?.providerUserId, "97484805");
    assert.equal(owner?.status, "ACTIVE");
  });

  it("6. partner A cannot operate partner B account (state user mismatch)", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("101010"),
      env: partnerEnv(),
    });
    const a = actor(10, [grant(10, "DNX_FINANCE_PARTNER_CONNECT")]);
    const b = actor(11, [grant(11, "DNX_FINANCE_PARTNER_CONNECT")]);
    const started = await service.startConnect({ actor: a });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    await assert.rejects(
      () => service.completeCallback({ actor: b, stateToken: token, code: "c" }),
      (err: unknown) =>
        err instanceof PartnerOAuthError && err.code === "STATE_USER_MISMATCH",
    );
  });

  it("7–9. callback partner + invalid state + duplicate callback", async () => {
    const store = createMemoryPartnerOAuthStore();
    await seedOwnerCollector(store);
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("202020"),
      env: partnerEnv(),
    });
    const partner = actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]);

    await assert.rejects(
      () =>
        service.completeCallback({
          actor: partner,
          stateToken: "invalid-state",
          code: "c",
        }),
      (err: unknown) =>
        err instanceof PartnerOAuthError && err.code === "STATE_NOT_FOUND",
    );

    const started = await service.startConnect({ actor: partner });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    const first = await service.completeCallback({
      actor: partner,
      stateToken: token,
      code: "c1",
    });
    const replay = await service.completeCallback({
      actor: partner,
      stateToken: token,
      code: "c2",
    });
    assert.equal(replay.paymentAccountId, first.paymentAccountId);
  });

  it("10. provider account conflict across users", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("shared-mp"),
      env: partnerEnv(),
    });
    const a = actor(10, [grant(10, "DNX_FINANCE_PARTNER_CONNECT")]);
    const b = actor(11, [grant(11, "DNX_FINANCE_PARTNER_CONNECT")]);
    const s1 = await service.startConnect({ actor: a });
    const t1 = new URL(s1.authorizeUrl).searchParams.get("state")!;
    await service.completeCallback({ actor: a, stateToken: t1, code: "c" });

    const s2 = await service.startConnect({ actor: b });
    const t2 = new URL(s2.authorizeUrl).searchParams.get("state")!;
    await assert.rejects(
      () => service.completeCallback({ actor: b, stateToken: t2, code: "c" }),
      (err: unknown) =>
        err instanceof PartnerOAuthError &&
        err.code === "PAYMENT_ACCOUNT_OWNERSHIP_CONFLICT",
    );
  });

  it("10G.2C collector MP via partner → COLLECTOR_ACCOUNT_REQUIRES_OWNER_RECONNECT", async () => {
    const store = createMemoryPartnerOAuthStore();
    await seedOwnerCollector(store);
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("97484805"),
      // Same env as collector PA (PROD) — mirrors Production conflict.
      env: partnerEnv({ [PARTNER_OAUTH_ENVIRONMENT_ENV]: "PROD" }),
    });
    const partner = actor(5, [
      grant(5, "DNX_FINANCE_PARTNER_CONNECT"),
      grant(5, "DNX_FINANCE_OWNER"),
    ]);
    const started = await service.startConnect({ actor: partner });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    await assert.rejects(
      () =>
        service.completeCallback({
          actor: partner,
          stateToken: token,
          code: "c",
        }),
      (err: unknown) =>
        err instanceof PartnerOAuthError &&
        err.code === "COLLECTOR_ACCOUNT_REQUIRES_OWNER_RECONNECT",
    );
    assert.equal(
      [...store.ownerStore.accounts.values()].filter(
        (a) => a.providerUserId === "97484805",
      ).length,
      1,
      "collector PA not duplicated",
    );
  });

  it("11–12. reconnect + revoke", async () => {
    const store = createMemoryPartnerOAuthStore();
    await seedOwnerCollector(store);
    const vaultStore = createMemoryCredentialStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore,
      mpClient: mockMp("303030"),
      env: partnerEnv(),
    });
    const partner = actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]);
    const s1 = await service.startConnect({ actor: partner });
    const t1 = new URL(s1.authorizeUrl).searchParams.get("state")!;
    await service.completeCallback({ actor: partner, stateToken: t1, code: "c" });

    const recon = await service.startReconnect({ actor: partner });
    const t2 = new URL(recon.authorizeUrl).searchParams.get("state")!;
    const after = await service.completeCallback({
      actor: partner,
      stateToken: t2,
      code: "c2",
    });
    assert.equal(after.status, "ACTIVE");

    const revoked = await service.revoke({
      actor: partner,
      reinforcedConfirm: true,
    });
    assert.equal(revoked.status, "REVOKED");
    const owner = await store.getOwnerCollectorSnapshot();
    assert.equal(owner?.id, "pa_owner_fixed");
  });

  it("13. LIVE/TEST separation on state env", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("404040"),
      env: partnerEnv({ [PARTNER_OAUTH_ENVIRONMENT_ENV]: "TEST" }),
    });
    const partner = actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]);
    const started = await service.startConnect({ actor: partner });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    const hash = hashOAuthStateToken(token);
    const row = store.ownerStore.states.get(hash)!;
    assert.equal(row.environment, "TEST");
    // Mutate env to PROD before callback
    const serviceProd = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("404040"),
      env: partnerEnv({ [PARTNER_OAUTH_ENVIRONMENT_ENV]: "PROD" }),
    });
    await assert.rejects(
      () =>
        serviceProd.completeCallback({
          actor: partner,
          stateToken: token,
          code: "c",
        }),
      (err: unknown) =>
        err instanceof PartnerOAuthError && err.code === "STATE_ENV_MISMATCH",
    );
  });

  it("14–15. vault purpose + feature flag off blocks connect", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp(),
      env: partnerEnv({ [PARTNER_SELF_CONNECT_FLAG]: "false" }),
    });
    await assert.rejects(
      () =>
        service.startConnect({
          actor: actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]),
        }),
      (err: unknown) =>
        err instanceof PartnerOAuthError &&
        err.code === "PARTNER_SELF_CONNECT_DISABLED",
    );
  });

  it("revoke blocked when account in active distribution", async () => {
    const store = createMemoryPartnerOAuthStore();
    const service = createTestPartnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("505050"),
      env: partnerEnv(),
    });
    const partner = actor(50, [grant(50, "DNX_FINANCE_PARTNER_CONNECT")]);
    const started = await service.startConnect({ actor: partner });
    const token = new URL(started.authorizeUrl).searchParams.get("state")!;
    const connected = await service.completeCallback({
      actor: partner,
      stateToken: token,
      code: "c",
    });
    store.activeDistributionAccountIds.add(connected.paymentAccountId);
    await assert.rejects(
      () => service.revoke({ actor: partner, reinforcedConfirm: true }),
      (err: unknown) =>
        err instanceof PartnerOAuthError &&
        err.code === "ACCOUNT_IN_ACTIVE_DISTRIBUTION",
    );
  });
});
