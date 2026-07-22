import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMemoryCredentialStore,
  UNIT_TEST_MASTER_KEY_BASE64,
} from "../../credential-vault/index.js";
import { createFinancialDomainStore } from "../../financial-identity/index.js";
import {
  classifyLegacyLabRow,
  classifyLegacyUserRow,
  rollbackMigratedPaymentAccount,
  runLegacyMpBackfill,
} from "./backfill.js";

describe("Legacy MP backfill", () => {
  it("classifies incomplete, conflict, eligible; dry-run writes nothing", async () => {
    process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST =
      UNIT_TEST_MASTER_KEY_BASE64;
    const store = createFinancialDomainStore();
    const credentialStore = createMemoryCredentialStore();
    const users = [
      {
        userId: 1,
        mpUserId: "TEST_A",
        mpAccessToken: "TEST-access-a",
        mpRefreshToken: null,
        mpConnectedAt: new Date(),
      },
      {
        userId: 2,
        mpUserId: null,
        mpAccessToken: "TEST-x",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
      {
        userId: 3,
        mpUserId: "TEST_A",
        mpAccessToken: "TEST-access-b",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
    ];

    const dry = await runLegacyMpBackfill({
      store,
      credentialStore,
      users,
      labs: [],
      environment: "TEST",
      dryRun: true,
    });
    assert.equal(dry.written, 0);
    assert.equal(store.accounts.size, 0);
    assert.equal(dry.counts.ELIGIBLE, 2);
    assert.equal(dry.counts.INCOMPLETE, 1);

    // Apply first eligible user
    const apply = await runLegacyMpBackfill({
      store,
      credentialStore,
      users: [users[0]!],
      labs: [],
      environment: "TEST",
      dryRun: false,
    });
    assert.equal(apply.written, 1);
    assert.equal(store.accounts.size, 1);
    assert.ok([...store.accounts.values()][0]?.credentialReference);

    // Idempotent
    const again = await runLegacyMpBackfill({
      store,
      credentialStore,
      users: [users[0]!],
      labs: [],
      environment: "TEST",
      dryRun: false,
    });
    assert.equal(again.written, 0);
    assert.equal(again.counts.ALREADY_MIGRATED, 1);

    // Conflict for same mpUserId other user
    const conflict = classifyLegacyUserRow(users[2]!, store, "TEST");
    assert.equal(conflict.classification, "CONFLICT_PROVIDER_ID");

    const accountId = [...store.accounts.keys()][0]!;
    rollbackMigratedPaymentAccount(store, accountId, 1, "test_rollback");
    assert.equal(store.accounts.get(accountId)?.status, "DISABLED");
  });

  it("lab without owner is REVIEW_REQUIRED; lab with owner eligible", () => {
    const store = createFinancialDomainStore();
    const noOwner = classifyLegacyLabRow(
      {
        labId: 9,
        ownerUserId: null,
        name: "Lab",
        country: "AR",
        mpUserId: "TEST_LAB",
        mpAccessToken: "TEST-lab",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
      store,
      "TEST",
    );
    assert.equal(noOwner.classification, "REVIEW_REQUIRED");

    const ok = classifyLegacyLabRow(
      {
        labId: 10,
        ownerUserId: 5,
        name: "Lab",
        country: "AR",
        mpUserId: "TEST_LAB_OK",
        mpAccessToken: "TEST-lab-ok",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
      store,
      "TEST",
    );
    assert.equal(ok.classification, "ELIGIBLE");
  });
});
