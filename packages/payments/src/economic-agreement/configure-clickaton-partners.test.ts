import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrders1nDryRun } from "../bridges/orders-1n-dry-run.js";
import {
  actor,
  createTestFinancialServices,
  grant,
} from "../testing/financial-fixtures.js";
import {
  CLICKATON_PARTNERS_BPS,
  CLICKATON_PARTNERS_MP_IDS,
  configureClickatonPartnersAgreement,
} from "./configure-clickaton-partners.js";
import { EconomicAgreementError } from "./errors.js";

describe("configureClickatonPartnersAgreement (10D3I-E)", () => {
  it("publishes 3400/3300/3300, snapshot 100000, and dry-runs Orders without HTTP", () => {
    const services = createTestFinancialServices();
    const daniUserId = 9101;
    const rodriUserId = 9102;
    const tammyUserId = 9103;
    const grantsByUserId = new Map([
      [
        daniUserId,
        [grant(daniUserId, "DNX_FINANCE_OWNER", "clickaton")],
      ],
    ]);

    const result = configureClickatonPartnersAgreement({
      store: services.store,
      identities: services.identities,
      agreements: services.agreements,
      partners: {
        dani: { key: "dani", userId: daniUserId, legalName: "Dani TEST" },
        rodri: { key: "rodri", userId: rodriUserId, legalName: "Rodri TEST" },
        tammy: { key: "tammy", userId: tammyUserId, legalName: "Tamara TEST" },
      },
      grantsByUserId,
      totalMinorForSnapshot: 100_000n,
    });

    assert.equal(result.alreadyConfigured, false);
    assert.equal(result.published.status, "PUBLISHED");
    assert.equal(result.bridge.totalBps, 10_000);
    assert.equal(result.amounts.dani, 34_000n);
    assert.equal(result.amounts.rodri, 33_000n);
    assert.equal(result.amounts.tammy, 33_000n);
    assert.ok(result.permissionProbes.every((p) => p.ok));

    const rules = [...services.store.rules.values()].filter(
      (r) => r.distributionVersionId === result.published.id,
    );
    const dry = buildOrders1nDryRun({
      agreement: result.agreement,
      version: result.published,
      rules,
      participants: [
        result.participants.dani,
        result.participants.rodri,
        result.participants.tammy,
      ],
      accountsById: services.store.accounts,
      totalMinor: 100_000n,
      ownerParticipantId: result.participants.dani.id,
      testReceiverIdsByParticipantId: new Map([
        [result.participants.dani.id, CLICKATON_PARTNERS_MP_IDS.dani],
        [result.participants.rodri.id, CLICKATON_PARTNERS_MP_IDS.rodri],
        [result.participants.tammy.id, CLICKATON_PARTNERS_MP_IDS.tammy],
      ]),
      externalReference: "test-orders-dry-run",
    });
    assert.equal(dry.mode, "SIMULATED_NOT_SENT");
    assert.equal(dry.realHttpCall, false);
    assert.equal(dry.recipients, 3);

    // Idempotent second configure
    const again = configureClickatonPartnersAgreement({
      store: services.store,
      identities: services.identities,
      agreements: services.agreements,
      partners: {
        dani: { key: "dani", userId: daniUserId, legalName: "Dani TEST" },
        rodri: { key: "rodri", userId: rodriUserId, legalName: "Rodri TEST" },
        tammy: { key: "tammy", userId: tammyUserId, legalName: "Tamara TEST" },
      },
      grantsByUserId,
      totalMinorForSnapshot: 100_000n,
    });
    assert.equal(again.alreadyConfigured, true);
    assert.equal(
      [...services.store.agreements.values()].length,
      1,
      "no duplicate agreements",
    );
    assert.equal(
      [...services.store.accounts.values()].filter((a) =>
        Object.values(CLICKATON_PARTNERS_MP_IDS).includes(
          a.providerUserId as (typeof CLICKATON_PARTNERS_MP_IDS)[keyof typeof CLICKATON_PARTNERS_MP_IDS],
        ),
      ).length,
      3,
    );
  });

  it("blocks rodri from publishing percentages", () => {
    const services = createTestFinancialServices();
    const daniUserId = 9201;
    const rodriUserId = 9202;
    const tammyUserId = 9203;
    const grantsByUserId = new Map([
      [daniUserId, [grant(daniUserId, "DNX_FINANCE_OWNER")]],
    ]);
    const result = configureClickatonPartnersAgreement({
      store: services.store,
      identities: services.identities,
      agreements: services.agreements,
      partners: {
        dani: { key: "dani", userId: daniUserId, legalName: "Dani TEST" },
        rodri: { key: "rodri", userId: rodriUserId, legalName: "Rodri TEST" },
        tammy: { key: "tammy", userId: tammyUserId, legalName: "Tamara TEST" },
      },
      grantsByUserId,
    });

    const rodriActor = actor(rodriUserId, [], [
      result.participants.rodri.financialIdentityId,
    ]);
    const draft = services.agreements.createDistributionDraft(
      actor(daniUserId, grantsByUserId.get(daniUserId)!),
      result.agreement.id,
    );
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: result.participants.dani.id,
      kind: "PERCENTAGE",
      value: CLICKATON_PARTNERS_BPS.dani,
      priority: 1,
    });
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: result.participants.rodri.id,
      kind: "PERCENTAGE",
      value: CLICKATON_PARTNERS_BPS.rodri,
      priority: 2,
    });
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: result.participants.tammy.id,
      kind: "PERCENTAGE",
      value: CLICKATON_PARTNERS_BPS.tammy,
      priority: 3,
    });

    assert.throws(
      () => services.agreements.publishDistributionVersion(rodriActor, draft.id),
      (err: unknown) =>
        err instanceof Error && err.name === "FinancePermissionDeniedError",
    );
  });

  it("rejects mutating published rules via re-publish of same draft", () => {
    const services = createTestFinancialServices();
    const daniUserId = 9301;
    const grantsByUserId = new Map([
      [daniUserId, [grant(daniUserId, "DNX_FINANCE_OWNER")]],
    ]);
    const result = configureClickatonPartnersAgreement({
      store: services.store,
      identities: services.identities,
      agreements: services.agreements,
      partners: {
        dani: { key: "dani", userId: daniUserId, legalName: "Dani TEST" },
        rodri: { key: "rodri", userId: 9302, legalName: "Rodri TEST" },
        tammy: { key: "tammy", userId: 9303, legalName: "Tamara TEST" },
      },
      grantsByUserId,
    });
    const daniActor = actor(daniUserId, grantsByUserId.get(daniUserId)!);
    assert.throws(
      () =>
        services.agreements.publishDistributionVersion(
          daniActor,
          result.published.id,
        ),
      (err: unknown) =>
        err instanceof EconomicAgreementError && err.code === "VERSION_NOT_DRAFT",
    );
  });
});
