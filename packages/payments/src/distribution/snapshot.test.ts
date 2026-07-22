import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actor,
  createTestFinancialServices,
  FIXTURE_USERS,
  grant,
  seedClickatonPartnersFixture,
} from "../testing/financial-fixtures.js";
import { hashEngineInput, toCompatibleDistributionSnapshotJson } from "./snapshot.js";

describe("OrderDistributionSnapshot", () => {
  it("is stable, includes version/participants/accounts, and stays immutable after v2", () => {
    const services = createTestFinancialServices();
    const seeded = seedClickatonPartnersFixture(services);
    const manager = actor(FIXTURE_USERS.financeOwner.userId, [
      grant(FIXTURE_USERS.financeOwner.userId, "PRODUCT_FINANCE_MANAGER", "clickaton"),
    ]);
    const agreement = services.agreements.createEconomicAgreement(manager, {
      productKey: "clickaton",
      scopeType: "EDITION",
      scopeId: "snap-test",
      name: "Snap",
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

    const first = services.agreements.buildAndPersistOrderSnapshot({
      agreementId: agreement.id,
      totalMinor: 100n,
      externalReference: "snap-a",
    });
    const second = services.agreements.buildAndPersistOrderSnapshot({
      agreementId: agreement.id,
      totalMinor: 100n,
      externalReference: "snap-b",
    });

    assert.equal(first.snapshot.engineInputHash, second.snapshot.engineInputHash);
    assert.equal(first.snapshot.versionNumber, 1);
    assert.ok(first.snapshot.payload.participants.every((p) => p.providerUserId));
    assert.ok(first.snapshot.payload.participants.every((p) => p.paymentAccountId));

    const compatible = toCompatibleDistributionSnapshotJson(first.snapshot);
    assert.equal(compatible.formalSnapshotId, first.snapshot.id);
    assert.equal(JSON.stringify(compatible).includes("credentialReference"), false);

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

    const after = services.agreements.getSnapshot(first.snapshot.id);
    assert.equal(after.versionNumber, 1);
    assert.equal(
      after.payload.participants.map((p) => p.shareBps).join(","),
      "3400,3300,3300",
    );

    // rounding: 100 ARS minor across 34/33/33
    const amounts = after.payload.participants.map((p) => BigInt(p.amountMinor));
    assert.equal(
      amounts.reduce((a, b) => a + b, 0n),
      100n,
    );

    assert.equal(
      hashEngineInput({ a: 1 }),
      hashEngineInput({ a: 1 }),
    );
  });
});
