import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPerformFinanceAction,
  FinancePermissionDeniedError,
} from "../finance-permissions/index.js";
import {
  actor,
  createTestFinancialServices,
  FIXTURE_USERS,
  grant,
  seedClickatonPartnersFixture,
} from "../testing/financial-fixtures.js";
import { EconomicAgreementError } from "./errors.js";

function managerActor() {
  return actor(FIXTURE_USERS.financeOwner.userId, [
    grant(FIXTURE_USERS.financeOwner.userId, "PRODUCT_FINANCE_MANAGER", "clickaton"),
  ]);
}

describe("EconomicAgreement", () => {
  it("creates agreement, invites, accepts, assigns own account, publishes 3400/3300/3300", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = managerActor();

    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "rosario-test-2026",
      name: "Clickatón Rosario Test",
      countryCode: "AR",
      currency: "ARS",
    });

    const pDani = services.agreements.inviteAgreementParticipant(manager, {
      agreementId: agreement.id,
      financialIdentityId: seeded.dani.id,
      roleLabel: "PARTNER",
    });
    const pRodri = services.agreements.inviteAgreementParticipant(manager, {
      agreementId: agreement.id,
      financialIdentityId: seeded.rodri.id,
      roleLabel: "PARTNER",
    });
    const pTammy = services.agreements.inviteAgreementParticipant(manager, {
      agreementId: agreement.id,
      financialIdentityId: seeded.tammy.id,
      roleLabel: "PARTNER",
    });

    const daniActor = actor(FIXTURE_USERS.dani.userId, [], [seeded.dani.id]);
    const rodriActor = actor(FIXTURE_USERS.rodri.userId, [], [seeded.rodri.id]);
    const tammyActor = actor(FIXTURE_USERS.tammy.userId, [], [seeded.tammy.id]);

    services.agreements.acceptAgreementParticipation(daniActor, pDani.id);
    services.agreements.acceptAgreementParticipation(rodriActor, pRodri.id);
    services.agreements.acceptAgreementParticipation(tammyActor, pTammy.id);

    services.agreements.assignParticipantPaymentAccount(daniActor, {
      participantId: pDani.id,
      paymentAccountId: seeded.daniAccount.id,
    });
    services.agreements.assignParticipantPaymentAccount(rodriActor, {
      participantId: pRodri.id,
      paymentAccountId: seeded.rodriAccount.id,
    });
    services.agreements.assignParticipantPaymentAccount(tammyActor, {
      participantId: pTammy.id,
      paymentAccountId: seeded.tammyAccount.id,
    });

    const draft = services.agreements.createDistributionDraft(manager, agreement.id);
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: pDani.id,
      kind: "PERCENTAGE",
      value: 3400,
      priority: 1,
    });
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: pRodri.id,
      kind: "PERCENTAGE",
      value: 3300,
      priority: 2,
    });
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: pTammy.id,
      kind: "PERCENTAGE",
      value: 3300,
      priority: 3,
    });

    const published = services.agreements.publishDistributionVersion(manager, draft.id);
    assert.equal(published.status, "PUBLISHED");
    assert.equal(published.versionNumber, 1);
    assert.ok(published.rulesHash);

    const { snapshot } = services.agreements.buildAndPersistOrderSnapshot({
      agreementId: agreement.id,
      totalMinor: 10_000n,
      externalReference: "sim-order-1",
    });
    assert.equal(snapshot.versionNumber, 1);
    assert.equal(snapshot.payload.participants.length, 3);
    const sum = snapshot.payload.participants.reduce(
      (acc, p) => acc + BigInt(p.amountMinor),
      0n,
    );
    assert.equal(sum, 10_000n);
  });

  it("rejects assigning another identity payment account", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = managerActor();
    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "mismatch-test",
      name: "Mismatch",
      countryCode: "AR",
      currency: "ARS",
    });
    const pDani = services.agreements.inviteAgreementParticipant(manager, {
      agreementId: agreement.id,
      financialIdentityId: seeded.dani.id,
      roleLabel: "PARTNER",
    });
    const daniActor = actor(FIXTURE_USERS.dani.userId, [], [seeded.dani.id]);
    services.agreements.acceptAgreementParticipation(daniActor, pDani.id);
    assert.throws(
      () =>
        services.agreements.assignParticipantPaymentAccount(daniActor, {
          participantId: pDani.id,
          paymentAccountId: seeded.rodriAccount.id,
        }),
      (err: unknown) =>
        err instanceof EconomicAgreementError &&
        err.code === "PAYMENT_ACCOUNT_IDENTITY_MISMATCH",
    );
  });

  it("rejects percentage sums 9999 and 10001; accepts 10000", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = managerActor();
    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "bps-test",
      name: "BPS",
      countryCode: "AR",
      currency: "ARS",
    });
    const participants = [seeded.dani, seeded.rodri, seeded.tammy].map((identity, idx) => {
      const account = [seeded.daniAccount, seeded.rodriAccount, seeded.tammyAccount][idx]!;
      const p = services.agreements.inviteAgreementParticipant(manager, {
        agreementId: agreement.id,
        financialIdentityId: identity.id,
        roleLabel: "PARTNER",
      });
      const self = actor(
        [FIXTURE_USERS.dani, FIXTURE_USERS.rodri, FIXTURE_USERS.tammy][idx]!.userId,
        [],
        [identity.id],
      );
      services.agreements.acceptAgreementParticipation(self, p.id);
      services.agreements.assignParticipantPaymentAccount(self, {
        participantId: p.id,
        paymentAccountId: account.id,
      });
      return p;
    });

    const draft = services.agreements.createDistributionDraft(manager, agreement.id);
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: participants[0]!.id,
      kind: "PERCENTAGE",
      value: 5000,
    });
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: participants[1]!.id,
      kind: "PERCENTAGE",
      value: 4999,
    });
    assert.equal(
      services.agreements.validateDistributionVersion(draft.id).ok,
      false,
    );

    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: participants[1]!.id,
      kind: "PERCENTAGE",
      value: 5001,
    });
    assert.equal(
      services.agreements.validateDistributionVersion(draft.id).ok,
      false,
    );

    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: participants[1]!.id,
      kind: "PERCENTAGE",
      value: 5000,
    });
    // still missing third — add 0 via third? need sum 10000 with 2 participants
    // remove third by overwriting: use only two rules totaling 10000
    // delete third by not including — we have 3 participants invited but only 2 rules
    assert.equal(services.agreements.validateDistributionVersion(draft.id).ok, true);
  });

  it("v2 supersedes v1; historical snapshot stays on v1; published is immutable", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = managerActor();
    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "versioning-test",
      name: "Versioning",
      countryCode: "AR",
      currency: "ARS",
    });

    const parts = [seeded.dani, seeded.rodri, seeded.tammy].map((identity, idx) => {
      const account = [seeded.daniAccount, seeded.rodriAccount, seeded.tammyAccount][idx]!;
      const p = services.agreements.inviteAgreementParticipant(manager, {
        agreementId: agreement.id,
        financialIdentityId: identity.id,
        roleLabel: "PARTNER",
      });
      const self = actor(
        [FIXTURE_USERS.dani, FIXTURE_USERS.rodri, FIXTURE_USERS.tammy][idx]!.userId,
        [],
        [identity.id],
      );
      services.agreements.acceptAgreementParticipation(self, p.id);
      services.agreements.assignParticipantPaymentAccount(self, {
        participantId: p.id,
        paymentAccountId: account.id,
      });
      return p;
    });

    const v1 = services.agreements.createDistributionDraft(manager, agreement.id);
    for (const [i, bps] of [3400, 3300, 3300].entries()) {
      services.agreements.addOrUpdateDraftRule({
        distributionVersionId: v1.id,
        agreementParticipantId: parts[i]!.id,
        kind: "PERCENTAGE",
        value: bps,
        priority: i + 1,
      });
    }
    services.agreements.publishDistributionVersion(manager, v1.id);
    const snap1 = services.agreements.buildAndPersistOrderSnapshot({
      agreementId: agreement.id,
      totalMinor: 10_000n,
      externalReference: "hist-1",
    });

    assert.throws(
      () =>
        services.agreements.addOrUpdateDraftRule({
          distributionVersionId: v1.id,
          agreementParticipantId: parts[0]!.id,
          kind: "PERCENTAGE",
          value: 4000,
        }),
      (err: unknown) =>
        err instanceof EconomicAgreementError && err.code === "VERSION_IMMUTABLE",
    );

    const v2 = services.agreements.createDistributionDraft(manager, agreement.id);
    for (const [i, bps] of [4000, 3000, 3000].entries()) {
      services.agreements.addOrUpdateDraftRule({
        distributionVersionId: v2.id,
        agreementParticipantId: parts[i]!.id,
        kind: "PERCENTAGE",
        value: bps,
        priority: i + 1,
      });
    }
    services.agreements.publishDistributionVersion(manager, v2.id);

    assert.equal(services.store.versions.get(v1.id)?.status, "SUPERSEDED");
    assert.equal(services.store.versions.get(v2.id)?.status, "PUBLISHED");
    assert.equal(snap1.snapshot.versionNumber, 1);
    assert.equal(
      snap1.snapshot.payload.participants.find((p) => p.shareBps === 3400)?.shareBps,
      3400,
    );

    const snap2 = services.agreements.buildAndPersistOrderSnapshot({
      agreementId: agreement.id,
      totalMinor: 10_000n,
      externalReference: "hist-2",
    });
    assert.equal(snap2.snapshot.versionNumber, 2);

    // EXITED does not mutate historical snapshot
    services.agreements.markParticipantExited(parts[2]!.id);
    assert.equal(services.agreements.getSnapshot(snap1.snapshot.id).versionNumber, 1);
    assert.equal(
      services.agreements.getSnapshot(snap1.snapshot.id).payload.participants.length,
      3,
    );
  });

  it("concurrency: second publish while locked fails", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = managerActor();
    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "lock-test",
      name: "Lock",
      countryCode: "AR",
      currency: "ARS",
    });
    const p = services.agreements.inviteAgreementParticipant(manager, {
      agreementId: agreement.id,
      financialIdentityId: seeded.dani.id,
      roleLabel: "PARTNER",
    });
    const daniActor = actor(FIXTURE_USERS.dani.userId, [], [seeded.dani.id]);
    services.agreements.acceptAgreementParticipation(daniActor, p.id);
    services.agreements.assignParticipantPaymentAccount(daniActor, {
      participantId: p.id,
      paymentAccountId: seeded.daniAccount.id,
    });
    const draft = services.agreements.createDistributionDraft(manager, agreement.id);
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: p.id,
      kind: "PERCENTAGE",
      value: 10_000,
    });

    services.store.publishLocks.add(agreement.id);
    assert.throws(
      () => services.agreements.publishDistributionVersion(manager, draft.id),
      (err: unknown) =>
        err instanceof EconomicAgreementError && err.code === "PUBLISH_IN_PROGRESS",
    );
    services.store.publishLocks.delete(agreement.id);
    services.agreements.publishDistributionVersion(manager, draft.id);
  });

  it("authorization: viewer cannot publish; other product manager denied; clickaton admin without grant denied", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = managerActor();
    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "authz-test",
      name: "Authz",
      countryCode: "AR",
      currency: "ARS",
    });
    const p = services.agreements.inviteAgreementParticipant(manager, {
      agreementId: agreement.id,
      financialIdentityId: seeded.dani.id,
      roleLabel: "PARTNER",
    });
    const daniActor = actor(FIXTURE_USERS.dani.userId, [], [seeded.dani.id]);
    services.agreements.acceptAgreementParticipation(daniActor, p.id);
    services.agreements.assignParticipantPaymentAccount(daniActor, {
      participantId: p.id,
      paymentAccountId: seeded.daniAccount.id,
    });
    const draft = services.agreements.createDistributionDraft(manager, agreement.id);
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: p.id,
      kind: "PERCENTAGE",
      value: 10_000,
    });

    const viewer = actor(9301, [
      grant(9301, "PRODUCT_FINANCE_VIEWER", "clickaton"),
    ]);
    assert.throws(
      () => services.agreements.publishDistributionVersion(viewer, draft.id),
      (err: unknown) => err instanceof FinancePermissionDeniedError,
    );

    const otherProduct = actor(9302, [
      grant(9302, "PRODUCT_FINANCE_MANAGER", "fotorank"),
    ]);
    assert.throws(
      () => services.agreements.publishDistributionVersion(otherProduct, draft.id),
      (err: unknown) => err instanceof FinancePermissionDeniedError,
    );

    const clickatonAdmin = actor(FIXTURE_USERS.clickatonAdminNoFinance.userId, []);
    assert.throws(
      () => services.agreements.publishDistributionVersion(clickatonAdmin, draft.id),
      (err: unknown) => err instanceof FinancePermissionDeniedError,
    );
  });

  it("suite owner can publish; admin can ops but owner-only manage_suite remains exclusive", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const owner = actor(FIXTURE_USERS.financeOwner.userId, [
      grant(FIXTURE_USERS.financeOwner.userId, "DNX_FINANCE_OWNER"),
    ]);
    const agreement = services.agreements.createEconomicAgreement(owner, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "owner-test",
      name: "Owner",
      countryCode: "AR",
      currency: "ARS",
    });
    const p = services.agreements.inviteAgreementParticipant(owner, {
      agreementId: agreement.id,
      financialIdentityId: seeded.dani.id,
      roleLabel: "PARTNER",
    });
    const daniActor = actor(FIXTURE_USERS.dani.userId, [], [seeded.dani.id]);
    services.agreements.acceptAgreementParticipation(daniActor, p.id);
    services.agreements.assignParticipantPaymentAccount(daniActor, {
      participantId: p.id,
      paymentAccountId: seeded.daniAccount.id,
    });
    const draft = services.agreements.createDistributionDraft(owner, agreement.id);
    services.agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: p.id,
      kind: "PERCENTAGE",
      value: 10_000,
    });
    const published = services.agreements.publishDistributionVersion(owner, draft.id);
    assert.equal(published.status, "PUBLISHED");

    const admin = actor(9400, [grant(9400, "DNX_FINANCE_ADMIN")]);
    assert.equal(canPerformFinanceAction(admin, "ops_finance"), true);
    assert.equal(canPerformFinanceAction(admin, "manage_suite_finance"), false);
    assert.equal(canPerformFinanceAction(owner, "manage_suite_finance"), true);
  });
});
