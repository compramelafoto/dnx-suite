import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryCredentialStore } from "../../credential-vault/vault.js";
import type { FinanceActor, FinanceGrant } from "../../finance-permissions/types.js";
import {
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  OWNER_ONBOARDING_FLAG,
  OWNER_OAUTH_MANUAL_AUTH_FLAG,
  OWNER_OAUTH_MANUAL_AUTH_PHRASE_ENV,
  CLICKATON_MP_REDIRECTS,
  CLICKATON_MP_NOTIFICATION_URLS,
} from "./config.js";
import {
  createDistributionPublishChallenge,
  verifyDistributionPublishChallenge,
} from "./dual-control.js";
import { hydrateClickatonProductionPaymentReadiness } from "./hydrate-readiness.js";
import type { ClickatonMpOAuthHttpClient } from "./mp-client.js";
import { hashOAuthStateToken } from "./pkce.js";
import {
  createTestOwnerOAuthService,
} from "./service.js";
import { createMemoryOwnerOAuthStore } from "./store.js";
import { OwnerOAuthError } from "./types.js";

function grant(userId: number, capability: FinanceGrant["capability"]): FinanceGrant {
  return {
    id: `g_${capability}`,
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

function authorizedEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [OWNER_ONBOARDING_FLAG]: "true",
    [OWNER_OAUTH_MANUAL_AUTH_FLAG]: "true",
    [OWNER_OAUTH_MANUAL_AUTH_PHRASE_ENV]: OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
    CLICKATON_MP_CLIENT_ID: "test-client-id",
    CLICKATON_MP_CLIENT_SECRET: "test-client-secret",
    CLICKATON_MP_REDIRECT_URI: CLICKATON_MP_REDIRECTS.staging,
    DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED: "false",
    DNX_MP_ORDERS_1N_STAGING_ENABLED: "false",
    DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED: "false",
    DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "false",
    ...extra,
  };
}

function mockMp(providerUserId = "99887766"): ClickatonMpOAuthHttpClient {
  return {
    async exchangeAuthorizationCode() {
      return {
        accessToken: "APP_USR-test-access-token-owner",
        refreshToken: "TG-test-refresh",
        expiresIn: 3600,
        providerUserId,
        scope: "offline_access read",
      };
    },
    async fetchAuthorizedUser() {
      return {
        providerUserId,
        nicknameMasked: "c***n",
        emailMasked: "o***@c***",
      };
    },
  };
}

describe("10D3I-I1 Clickatón owner OAuth", () => {
  it("documents production and staging redirects/notifications", () => {
    assert.equal(
      CLICKATON_MP_REDIRECTS.production,
      "https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback",
    );
    assert.equal(
      CLICKATON_MP_REDIRECTS.staging,
      "https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback",
    );
    assert.equal(
      CLICKATON_MP_NOTIFICATION_URLS.production,
      "https://maratonfotografica.com/api/webhooks/dnx-payments",
    );
  });

  it("blocks connect without finance owner grant", async () => {
    const store = createMemoryOwnerOAuthStore();
    const service = createTestOwnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp(),
      env: authorizedEnv(),
    });
    await assert.rejects(
      () =>
        service.startConnect({
          actor: actor(1, [grant(1, "PRODUCT_FINANCE_MANAGER")]),
        }),
      (err: unknown) =>
        err instanceof OwnerOAuthError && err.code === "FORBIDDEN_NOT_FINANCE_OWNER",
    );
  });

  it("blocks live OAuth without manual authorization phrase", async () => {
    const store = createMemoryOwnerOAuthStore();
    const service = createTestOwnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp(),
      env: {
        ...authorizedEnv(),
        [OWNER_OAUTH_MANUAL_AUTH_FLAG]: "false",
      },
    });
    await assert.rejects(
      () => service.startConnect({ actor: actor(1, [grant(1, "DNX_FINANCE_OWNER")]) }),
      (err: unknown) =>
        err instanceof OwnerOAuthError && err.code === "OWNER_OAUTH_NOT_AUTHORIZED",
    );
  });

  it("completes OAuth with PKCE, encrypts token, never exposes access token", async () => {
    const store = createMemoryOwnerOAuthStore();
    const vaultStore = createMemoryCredentialStore();
    const service = createTestOwnerOAuthService({
      store,
      vaultStore,
      mpClient: mockMp("11223344"),
      env: authorizedEnv(),
    });
    const owner = actor(7, [grant(7, "DNX_FINANCE_OWNER")]);
    const started = await service.startConnect({ actor: owner });
    assert.ok(started.authorizeUrl.includes("code_challenge"));
    assert.ok(started.authorizeUrl.includes("state="));
    assert.equal(started.authorizeUrl.includes("APP_USR"), false);

    const stateRow = [...store.states.values()][0];
    assert.ok(stateRow);
    // Recover plaintext state by brute of known hash map — tests store hash only;
    // recreate by capturing from authorize URL.
    const stateFromUrl = new URL(started.authorizeUrl).searchParams.get("state");
    assert.ok(stateFromUrl);
    assert.equal(hashOAuthStateToken(stateFromUrl!), stateRow.stateHash);

    const result = await service.completeCallback({
      actor: owner,
      stateToken: stateFromUrl!,
      code: "auth-code-test",
    });
    assert.equal(result.status, "ACTIVE");
    assert.equal(result.providerUserIdMasked.includes("11223344"), false);

    const account = [...store.accounts.values()][0];
    assert.ok(account?.credentialReference);
    assert.equal(account?.originApp, "clickaton");
    assert.ok(account?.externalReference?.includes("dedicatedProduct=clickaton"));
    const cred = vaultStore.records.get(account!.credentialReference!);
    assert.ok(cred);
    assert.equal(JSON.stringify(cred).includes("APP_USR-test-access-token-owner"), false);

    const panel = await service.getPanelView(owner);
    assert.equal(panel.status, "ACTIVE");
    assert.equal(JSON.stringify(panel).includes("APP_USR"), false);
    assert.equal(JSON.stringify(panel).includes("11223344"), false);
  });

  it("rejects expired and replayed state", async () => {
    const store = createMemoryOwnerOAuthStore();
    const service2 = createTestOwnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp(),
      env: authorizedEnv(),
    });
    const owner = actor(3, [grant(3, "DNX_FINANCE_OWNER")]);
    const started = await service2.startConnect({ actor: owner });
    const stateToken = new URL(started.authorizeUrl).searchParams.get("state")!;
    const row = [...store.states.values()][0];
    store.states.set(row.stateHash, {
      ...row,
      expiresAt: new Date(Date.now() - 1000),
    });
    await assert.rejects(
      () =>
        service2.completeCallback({
          actor: owner,
          stateToken,
          code: "x",
        }),
      (err: unknown) => err instanceof OwnerOAuthError && err.code === "STATE_EXPIRED",
    );

    const store3 = createMemoryOwnerOAuthStore();
    const s3 = createTestOwnerOAuthService({
      store: store3,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("555"),
      env: authorizedEnv(),
    });
    const started3 = await s3.startConnect({ actor: owner });
    const st3 = new URL(started3.authorizeUrl).searchParams.get("state")!;
    await s3.completeCallback({ actor: owner, stateToken: st3, code: "c1" });
    await assert.rejects(
      () => s3.completeCallback({ actor: owner, stateToken: st3, code: "c2" }),
      (err: unknown) => err instanceof OwnerOAuthError && err.code === "STATE_REPLAY",
    );
  });

  it("blocks callback for wrong user and duplicate account", async () => {
    const store = createMemoryOwnerOAuthStore();
    const s = createTestOwnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("777"),
      env: authorizedEnv(),
    });
    const owner = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);
    const other = actor(2, [grant(2, "DNX_FINANCE_OWNER")]);
    const started = await s.startConnect({ actor: owner });
    const stateToken = new URL(started.authorizeUrl).searchParams.get("state")!;
    await assert.rejects(
      () => s.completeCallback({ actor: other, stateToken, code: "c" }),
      (err: unknown) =>
        err instanceof OwnerOAuthError && err.code === "STATE_USER_MISMATCH",
    );

    await s.completeCallback({ actor: owner, stateToken, code: "c" });

    const store2 = createMemoryOwnerOAuthStore();
    // seed duplicate binding on another FI
    const otherFi = await store2.getOrCreateOwnerIdentity({
      organizationRef: "other-org",
      ownerUserId: 99,
      legalName: "Other",
    });
    await store2.upsertOwnerPaymentAccount({
      id: "pa_dup",
      financialIdentityId: otherFi.id,
      provider: "MERCADOPAGO",
      environment: "PROD",
      providerUserId: "777",
      credentialReference: "cred_x",
      originApp: "clickaton",
      externalReference: "x",
      tokenFingerprint: "fp",
      capabilities: ["COLLECTOR"],
      status: "ACTIVE",
      connectedAt: new Date(),
      verifiedAt: new Date(),
      lastHealthCheckAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const s2 = createTestOwnerOAuthService({
      store: store2,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("777"),
      env: authorizedEnv(),
    });
    const started2 = await s2.startConnect({ actor: owner });
    const st2 = new URL(started2.authorizeUrl).searchParams.get("state")!;
    await assert.rejects(
      () => s2.completeCallback({ actor: owner, stateToken: st2, code: "c" }),
      (err: unknown) => err instanceof OwnerOAuthError && err.code === "ACCOUNT_DUPLICATE",
    );
  });

  it("blocks owner replacement with a different provider account", async () => {
    const store = createMemoryOwnerOAuthStore();
    const s = createTestOwnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("111"),
      env: authorizedEnv(),
    });
    const owner = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);
    const started = await s.startConnect({ actor: owner });
    const st = new URL(started.authorizeUrl).searchParams.get("state")!;
    await s.completeCallback({ actor: owner, stateToken: st, code: "c" });

    const s2 = createTestOwnerOAuthService({
      store,
      vaultStore: createMemoryCredentialStore(),
      mpClient: mockMp("222"),
      env: authorizedEnv(),
    });
    const started2 = await s2.startReconnect({ actor: owner });
    const st2 = new URL(started2.authorizeUrl).searchParams.get("state")!;
    await assert.rejects(
      () => s2.completeCallback({ actor: owner, stateToken: st2, code: "c2" }),
      (err: unknown) =>
        err instanceof OwnerOAuthError && err.code === "OWNER_REPLACEMENT_BLOCKED",
    );
  });

  it("revokes account and invalidates credential reference", async () => {
    const store = createMemoryOwnerOAuthStore();
    const vaultStore = createMemoryCredentialStore();
    const s = createTestOwnerOAuthService({
      store,
      vaultStore,
      mpClient: mockMp("333"),
      env: authorizedEnv(),
    });
    const owner = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);
    const started = await s.startConnect({ actor: owner });
    const st = new URL(started.authorizeUrl).searchParams.get("state")!;
    await s.completeCallback({ actor: owner, stateToken: st, code: "c" });
    const before = [...store.accounts.values()][0];
    assert.ok(before.credentialReference);
    await assert.rejects(
      () => s.revoke({ actor: owner, reinforcedConfirm: false }),
      (err: unknown) => err instanceof OwnerOAuthError && err.code === "REAUTH_REQUIRED",
    );
    const revoked = await s.revoke({ actor: owner, reinforcedConfirm: true });
    assert.equal(revoked.status, "REVOKED");
    const after = [...store.accounts.values()][0];
    assert.equal(after.status, "REVOKED");
    assert.equal(after.credentialReference, null);
  });

  it("hydrates readiness with owner ACTIVE but partners missing and flags OFF", () => {
    const result = hydrateClickatonProductionPaymentReadiness({
      ownerAccount: {
        id: "pa1",
        financialIdentityId: "fi1",
        provider: "MERCADOPAGO",
        environment: "PROD",
        providerUserId: "999",
        credentialReference: "cred1",
        originApp: "clickaton",
        externalReference: "dedicatedProduct=clickaton",
        tokenFingerprint: "fp",
        capabilities: ["COLLECTOR"],
        status: "ACTIVE",
        connectedAt: new Date(),
        verifiedAt: new Date(),
        lastHealthCheckAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      env: authorizedEnv(),
    });
    assert.equal(result.ownerConnected, true);
    assert.equal(result.ownerVerified, true);
    assert.equal(result.partnerRodrigoConnected, false);
    assert.equal(result.partnerTamaraConnected, false);
    assert.equal(result.readyForMicroTransaction, false);
    assert.equal(result.readyForCutover, false);
    assert.equal(result.productionFlagsOff, true);
    assert.ok(result.blockers.includes("partnerRodrigoConnected"));
    assert.ok(result.blockers.includes("partnerTamaraConnected"));
  });

  it("dual-control challenge verifies code + confirmation text", () => {
    const { challenge, plaintextCode } = createDistributionPublishChallenge({
      agreementId: "ag1",
      draftVersionId: "dv1",
      initiatedByUserId: 1,
    });
    assert.equal(
      verifyDistributionPublishChallenge({
        challenge,
        code: "wrong",
        confirmationText: challenge.requiredConfirmationText,
        actorUserId: 1,
      }).ok,
      false,
    );
    assert.equal(
      verifyDistributionPublishChallenge({
        challenge,
        code: plaintextCode,
        confirmationText: challenge.requiredConfirmationText,
        actorUserId: 1,
      }).ok,
      true,
    );
  });
});
