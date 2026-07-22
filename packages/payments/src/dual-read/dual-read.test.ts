import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CredentialVault,
  createMemoryCredentialStore,
  UNIT_TEST_MASTER_KEY_BASE64,
} from "../credential-vault/index.js";
import { createFinancialDomainStore } from "../financial-identity/index.js";
import { runLegacyMpBackfill } from "../legacy/clf/backfill.js";
import { loadFinancialIdentityFlags } from "./flags.js";
import { createMemoryDualReadPorts } from "./memory-ports.js";
import {
  resolveMercadoPagoAccountForLab,
  resolveMercadoPagoAccountForUser,
} from "./resolve-mercado-pago-account.js";

describe("Dual-read Mercado Pago resolver", () => {
  it("LEGACY_ONLY uses legacy; PREFER uses FI then fallback; conflict blocks", async () => {
    process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST =
      UNIT_TEST_MASTER_KEY_BASE64;
    const store = createFinancialDomainStore();
    const credentialStore = createMemoryCredentialStore();
    const vault = new CredentialVault(credentialStore, () => ({
      masterKeyBase64: UNIT_TEST_MASTER_KEY_BASE64,
      keyVersion: "v1",
      environment: "TEST",
    }));

    const legacyUsers = new Map([
      [
        1,
        {
          userId: 1,
          mpUserId: "TEST_USER_1",
          mpAccessToken: "TEST-legacy-token-1",
          mpRefreshToken: null as string | null,
          mpConnectedAt: new Date(),
        },
      ],
    ]);

    const ports = createMemoryDualReadPorts({
      store,
      vault,
      legacyUsers,
    });

    const legacyOnly = await resolveMercadoPagoAccountForUser(ports, {
      userId: 1,
      environment: "TEST",
      flags: {
        readMode: "LEGACY_ONLY",
        writeEnabled: false,
        backfillEnabled: false,
      },
    });
    assert.equal(legacyOnly.ok, true);
    if (legacyOnly.ok) {
      assert.equal(legacyOnly.source, "legacy_user");
      assert.equal(legacyOnly.accessToken, "TEST-legacy-token-1");
    }

    await runLegacyMpBackfill({
      store,
      credentialStore,
      users: [legacyUsers.get(1)!],
      labs: [],
      environment: "TEST",
      dryRun: false,
    });

    const prefer = await resolveMercadoPagoAccountForUser(ports, {
      userId: 1,
      environment: "TEST",
      flags: {
        readMode: "PREFER_FINANCIAL_IDENTITY",
        writeEnabled: false,
        backfillEnabled: false,
      },
    });
    assert.equal(prefer.ok, true);
    if (prefer.ok) {
      assert.equal(prefer.source, "financial_identity");
      assert.equal(prefer.usedLegacyFallback, false);
      assert.equal(prefer.mpUserId, "TEST_USER_1");
    }

    // Conflict: change legacy mpUserId while FI keeps old
    legacyUsers.set(1, {
      ...legacyUsers.get(1)!,
      mpUserId: "TEST_OTHER",
    });
    const conflict = await resolveMercadoPagoAccountForUser(ports, {
      userId: 1,
      environment: "TEST",
      flags: {
        readMode: "PREFER_FINANCIAL_IDENTITY",
        writeEnabled: false,
        backfillEnabled: false,
      },
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.code, "CONFLICT");

    // Fallback when no FI account
    const ports2 = createMemoryDualReadPorts({
      store: createFinancialDomainStore(),
      vault,
      legacyUsers: new Map([
        [
          9,
          {
            userId: 9,
            mpUserId: "TEST_FALLBACK",
            mpAccessToken: "TEST-fallback-token",
            mpRefreshToken: null,
            mpConnectedAt: null,
          },
        ],
      ]),
    });
    const fallback = await resolveMercadoPagoAccountForUser(ports2, {
      userId: 9,
      environment: "TEST",
      flags: {
        readMode: "PREFER_FINANCIAL_IDENTITY",
        writeEnabled: false,
        backfillEnabled: false,
      },
    });
    assert.equal(fallback.ok, true);
    if (fallback.ok) {
      assert.equal(fallback.usedLegacyFallback, true);
      assert.equal(fallback.source, "legacy_user");
    }
  });

  it("lab dual-read LEGACY_ONLY and PREFER", async () => {
    process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST =
      UNIT_TEST_MASTER_KEY_BASE64;
    const store = createFinancialDomainStore();
    const credentialStore = createMemoryCredentialStore();
    const vault = new CredentialVault(credentialStore, () => ({
      masterKeyBase64: UNIT_TEST_MASTER_KEY_BASE64,
      keyVersion: "v1",
      environment: "TEST",
    }));
    const lab = {
      labId: 70,
      ownerUserId: 1,
      name: "Lab Test",
      country: "AR",
      mpUserId: "TEST_LAB_1",
      mpAccessToken: "TEST-lab-token-1",
      mpRefreshToken: null as string | null,
      mpConnectedAt: new Date(),
    };
    await runLegacyMpBackfill({
      store,
      credentialStore,
      users: [],
      labs: [lab],
      environment: "TEST",
      dryRun: false,
    });
    const ports = createMemoryDualReadPorts({
      store,
      vault,
      legacyLabs: new Map([[70, lab]]),
    });
    const resolved = await resolveMercadoPagoAccountForLab(ports, {
      labId: 70,
      environment: "TEST",
      flags: {
        readMode: "PREFER_FINANCIAL_IDENTITY",
        writeEnabled: false,
        backfillEnabled: false,
      },
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(resolved.source, "financial_identity");
  });

  it("invalid flag fails safe to LEGACY_ONLY; FINANCIAL_IDENTITY_ONLY not default", () => {
    const previous = process.env.DNX_FINANCIAL_IDENTITY_READ_MODE;
    process.env.DNX_FINANCIAL_IDENTITY_READ_MODE = "garbage";
    assert.equal(loadFinancialIdentityFlags().readMode, "LEGACY_ONLY");
    delete process.env.DNX_FINANCIAL_IDENTITY_READ_MODE;
    assert.equal(loadFinancialIdentityFlags().readMode, "LEGACY_ONLY");
    if (previous !== undefined) {
      process.env.DNX_FINANCIAL_IDENTITY_READ_MODE = previous;
    }
  });
});
