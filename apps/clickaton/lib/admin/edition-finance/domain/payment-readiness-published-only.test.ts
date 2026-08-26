import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolvePublishedVersionForCharges,
  shouldFreezeParticipantAccountForDraft,
} from "./resolve-published-for-charges";
import { evaluateCommercialFinanceGate } from "./gate";
import type { EditionFinancialDistributionView } from "./types";
import {
  createEditionFinanceService,
  createInMemoryEditionFinanceStore,
} from "../application/edition-finance-service";
import type { FinanceActor, FinanceGrant } from "../permissions";

function grant(userId: number, capability: FinanceGrant["capability"]): FinanceGrant {
  return {
    id: `g_${capability}_${userId}`,
    userId,
    capability,
    productKey: "clickaton",
    scopeType: "EDITION",
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

function liveOwnerDistribution(
  overrides: Partial<EditionFinancialDistributionView> = {},
): EditionFinancialDistributionView {
  return {
    id: "agr_1",
    editionId: "ed_1",
    versionId: "dv_v1",
    version: 1,
    status: "ACTIVE",
    versionStatus: "PUBLISHED",
    agreementStatus: "ACTIVE",
    effectiveFrom: new Date(),
    effectiveUntil: null,
    createdByUserId: 1,
    activatedByUserId: 1,
    activatedAt: new Date(),
    feePolicy: null,
    roundingPolicy: "LARGEST_REMAINDER",
    allocations: [
      {
        id: "ap_owner",
        beneficiaryUserId: 1,
        beneficiaryDisplayName: "Clickatón Owner",
        beneficiaryEmailMasked: "ow•••@example.com",
        financialIdentityId: "fi_owner",
        paymentConnectionId: "acc_owner_live",
        paymentConnection: {
          id: "acc_owner_live",
          provider: "MERCADO_PAGO",
          environment: "LIVE",
          status: "ACTIVE",
          providerUserId: "mp_owner",
          connectedAt: new Date(),
          lastError: null,
          canReceivePayments: true,
        },
        role: "ORGANIZER",
        shareType: "PERCENTAGE",
        shareValue: 100,
        shareBps: 10_000,
        sortOrder: 10,
        participantStatus: "ACCEPTED",
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("resolvePublishedVersionForCharges", () => {
  it("uses current PUBLISHED and ignores DRAFT siblings", () => {
    const picked = resolvePublishedVersionForCharges({
      agreement: { id: "a", status: "ACTIVE", currentVersionId: "v1" },
      currentVersion: { id: "v1", versionNumber: 1, status: "PUBLISHED" },
      versions: [
        { id: "v1", versionNumber: 1, status: "PUBLISHED" },
        { id: "v2", versionNumber: 2, status: "DRAFT" },
      ],
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.version.id, "v1");
    assert.equal(picked.usedFallback, false);
  });

  it("falls back to latest PUBLISHED when currentVersionId points to DRAFT", () => {
    const picked = resolvePublishedVersionForCharges({
      agreement: { id: "a", status: "ACTIVE", currentVersionId: "v2" },
      currentVersion: { id: "v2", versionNumber: 2, status: "DRAFT" },
      versions: [
        { id: "v1", versionNumber: 1, status: "PUBLISHED" },
        { id: "v2", versionNumber: 2, status: "DRAFT" },
      ],
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.version.id, "v1");
    assert.equal(picked.usedFallback, true);
    assert.equal(picked.reason, "fallback_latest_published");
  });

  it("blocks when there is no published version", () => {
    const picked = resolvePublishedVersionForCharges({
      agreement: { id: "a", status: "ACTIVE", currentVersionId: "v2" },
      currentVersion: { id: "v2", versionNumber: 2, status: "DRAFT" },
      versions: [{ id: "v2", versionNumber: 2, status: "DRAFT" }],
    });
    assert.equal(picked.ok, false);
  });
});

describe("shouldFreezeParticipantAccountForDraft", () => {
  it("freezes published participant accounts while editing a draft", () => {
    assert.equal(
      shouldFreezeParticipantAccountForDraft({
        writingVersionStatus: "DRAFT",
        publishedVersionId: "v1",
        publishedVersionStatus: "PUBLISHED",
        participantUsedByPublished: true,
      }),
      true,
    );
  });

  it("allows new draft-only beneficiaries to set accounts", () => {
    assert.equal(
      shouldFreezeParticipantAccountForDraft({
        writingVersionStatus: "DRAFT",
        publishedVersionId: "v1",
        publishedVersionStatus: "PUBLISHED",
        participantUsedByPublished: false,
      }),
      false,
    );
  });
});

describe("evaluateCommercialFinanceGate — published only", () => {
  it("enables payments for valid published V1 even if a draft exists elsewhere", () => {
    const gate = evaluateCommercialFinanceGate({
      mode: "LIVE",
      distribution: liveOwnerDistribution(),
      dnxPaymentsReady: true,
      webhookConfigured: true,
      hasActivePricePhase: true,
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.distribution?.versionId, "dv_v1");
  });

  it("blocks when distribution is null (no published)", () => {
    const gate = evaluateCommercialFinanceGate({
      mode: "LIVE",
      distribution: null,
      dnxPaymentsReady: true,
      webhookConfigured: true,
      hasActivePricePhase: true,
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.blockers.some((b) => /ACTIVE/i.test(b)));
  });
});

describe("edition finance checkout uses published V1 over incomplete V2 draft", () => {
  it("V1 published + V2 incomplete draft => payments enabled and snapshot uses V1", () => {
    const store = createInMemoryEditionFinanceStore();
    const svc = createEditionFinanceService(store);
    const editionId = "ed_primavera_2026";
    const daniel = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);

    store.identities.set("fi_owner", {
      id: "fi_owner",
      ownerUserId: 1,
      displayName: "Clickatón Owner",
      email: "owner@clickaton.test",
    });
    store.identities.set("fi_tammy", {
      id: "fi_tammy",
      ownerUserId: 2,
      displayName: "Tammy",
      email: "tammy@example.com",
    });
    store.accounts.set("acc_owner_live", {
      id: "acc_owner_live",
      financialIdentityId: "fi_owner",
      provider: "MERCADO_PAGO",
      environment: "LIVE",
      status: "ACTIVE",
      providerUserId: "mp_owner",
      connectedAt: new Date(),
      lastError: null,
      canReceivePayments: true,
    });
    // Tammy sin cuenta usable (borrador incompleto a nivel operativo).
    store.accounts.set("acc_tammy_bad", {
      id: "acc_tammy_bad",
      financialIdentityId: "fi_tammy",
      provider: "MERCADO_PAGO",
      environment: "TEST",
      status: "NEEDS_REAUTH",
      providerUserId: "mp_tammy",
      connectedAt: new Date(),
      lastError: "needs_reauth",
      canReceivePayments: false,
    });

    const v1draft = svc.createDraftDistribution(daniel, {
      editionId,
      name: "Owner 100%",
      allocations: [
        {
          financialIdentityId: "fi_owner",
          sharePercent: 100,
          paymentConnectionId: "acc_owner_live",
        },
      ],
    });
    const v1 = svc.activateDistribution(daniel, {
      editionId,
      versionId: v1draft.versionId!,
    });
    assert.equal(v1.status, "ACTIVE");
    assert.equal(v1.version, 1);

    // V2 borrador Tammy 100% (cuenta no lista). No debe afectar cobros.
    const v2 = svc.createDraftDistribution(daniel, {
      editionId,
      name: "Tammy 100%",
      allocations: [
        {
          financialIdentityId: "fi_tammy",
          sharePercent: 100,
          paymentConnectionId: "acc_tammy_bad",
        },
      ],
    });
    assert.equal(v2.status, "DRAFT");
    assert.equal(v2.version, 2);

    const active = svc.resolveActiveDistribution(editionId);
    assert.ok(active);
    assert.equal(active!.version, 1);
    assert.equal(active!.versionId, v1.versionId);
    assert.equal(active!.allocations[0]?.paymentConnectionId, "acc_owner_live");

    const gate = svc.evaluateGate({
      editionId,
      mode: "LIVE",
      dnxPaymentsReady: true,
      webhookConfigured: true,
      hasActivePricePhase: true,
    });
    assert.equal(gate.ok, true, gate.blockers.join(" | "));

    const snap = svc.buildSnapshotForRegistration({
      editionId,
      registrationId: "reg_min_fixture",
      currency: "ARS",
      grossAmount: 100,
      discountAmount: 0,
    });
    assert.equal(snap.distributionVersion, 1);
    assert.equal(snap.distributionVersionId, v1.versionId);
    assert.equal(snap.allocations[0]?.paymentAccountId, "acc_owner_live");
  });

  it("no published distribution => payments blocked", () => {
    const store = createInMemoryEditionFinanceStore();
    const svc = createEditionFinanceService(store);
    const editionId = "ed_no_pub";
    const daniel = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);

    store.identities.set("fi_tammy", {
      id: "fi_tammy",
      ownerUserId: 2,
      displayName: "Tammy",
      email: "tammy@example.com",
    });
    store.accounts.set("acc_tammy", {
      id: "acc_tammy",
      financialIdentityId: "fi_tammy",
      provider: "MERCADO_PAGO",
      environment: "LIVE",
      status: "ACTIVE",
      providerUserId: "mp_t",
      connectedAt: new Date(),
      lastError: null,
      canReceivePayments: true,
    });

    svc.createDraftDistribution(daniel, {
      editionId,
      name: "Tammy draft only",
      allocations: [
        {
          financialIdentityId: "fi_tammy",
          sharePercent: 100,
          paymentConnectionId: "acc_tammy",
        },
      ],
    });

    assert.equal(svc.resolveActiveDistribution(editionId), null);
    const gate = svc.evaluateGate({
      editionId,
      mode: "LIVE",
      dnxPaymentsReady: true,
      webhookConfigured: true,
      hasActivePricePhase: true,
    });
    assert.equal(gate.ok, false);
  });

  it("after publishing V2, checkout uses V2", () => {
    const store = createInMemoryEditionFinanceStore();
    const svc = createEditionFinanceService(store);
    const editionId = "ed_switch_v2";
    const daniel = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);

    store.identities.set("fi_owner", {
      id: "fi_owner",
      ownerUserId: 1,
      displayName: "Owner",
      email: "owner@clickaton.test",
    });
    store.identities.set("fi_tammy", {
      id: "fi_tammy",
      ownerUserId: 2,
      displayName: "Tammy",
      email: "tammy@example.com",
    });
    store.accounts.set("acc_owner_live", {
      id: "acc_owner_live",
      financialIdentityId: "fi_owner",
      provider: "MERCADO_PAGO",
      environment: "LIVE",
      status: "ACTIVE",
      providerUserId: "mp_o",
      connectedAt: new Date(),
      lastError: null,
      canReceivePayments: true,
    });
    store.accounts.set("acc_tammy_live", {
      id: "acc_tammy_live",
      financialIdentityId: "fi_tammy",
      provider: "MERCADO_PAGO",
      environment: "LIVE",
      status: "ACTIVE",
      providerUserId: "mp_t",
      connectedAt: new Date(),
      lastError: null,
      canReceivePayments: true,
    });

    const v1d = svc.createDraftDistribution(daniel, {
      editionId,
      name: "Owner",
      allocations: [
        {
          financialIdentityId: "fi_owner",
          sharePercent: 100,
          paymentConnectionId: "acc_owner_live",
        },
      ],
    });
    svc.activateDistribution(daniel, { editionId, versionId: v1d.versionId! });

    const v2d = svc.createDraftDistribution(daniel, {
      editionId,
      name: "Tammy",
      allocations: [
        {
          financialIdentityId: "fi_tammy",
          sharePercent: 100,
          paymentConnectionId: "acc_tammy_live",
        },
      ],
    });
    const v2 = svc.activateDistribution(daniel, {
      editionId,
      versionId: v2d.versionId!,
    });

    const active = svc.resolveActiveDistribution(editionId);
    assert.equal(active?.version, 2);
    assert.equal(active?.versionId, v2.versionId);
    assert.equal(active?.allocations[0]?.paymentConnectionId, "acc_tammy_live");

    const snap = svc.buildSnapshotForRegistration({
      editionId,
      registrationId: "reg_after_v2",
      currency: "ARS",
      grossAmount: 500,
      discountAmount: 0,
    });
    assert.equal(snap.distributionVersion, 2);
    assert.equal(snap.allocations[0]?.paymentAccountId, "acc_tammy_live");
  });

  it("draft must not overwrite published Owner payment account", () => {
    const store = createInMemoryEditionFinanceStore();
    const svc = createEditionFinanceService(store);
    const editionId = "ed_freeze_owner";
    const daniel = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);

    store.identities.set("fi_owner", {
      id: "fi_owner",
      ownerUserId: 1,
      displayName: "Owner",
      email: "owner@clickaton.test",
    });
    store.accounts.set("acc_owner_live", {
      id: "acc_owner_live",
      financialIdentityId: "fi_owner",
      provider: "MERCADO_PAGO",
      environment: "LIVE",
      status: "ACTIVE",
      providerUserId: "mp_o",
      connectedAt: new Date(),
      lastError: null,
      canReceivePayments: true,
    });
    store.accounts.set("acc_owner_alt", {
      id: "acc_owner_alt",
      financialIdentityId: "fi_owner",
      provider: "MERCADO_PAGO",
      environment: "TEST",
      status: "ACTIVE",
      providerUserId: "mp_alt",
      connectedAt: new Date(),
      lastError: null,
      canReceivePayments: true,
    });

    const v1d = svc.createDraftDistribution(daniel, {
      editionId,
      name: "Owner",
      allocations: [
        {
          financialIdentityId: "fi_owner",
          sharePercent: 100,
          paymentConnectionId: "acc_owner_live",
        },
      ],
    });
    svc.activateDistribution(daniel, { editionId, versionId: v1d.versionId! });

    const v2d = svc.createDraftDistribution(daniel, {
      editionId,
      name: "Owner draft alt",
      allocations: [
        {
          financialIdentityId: "fi_owner",
          sharePercent: 100,
          paymentConnectionId: "acc_owner_alt",
        },
      ],
    });
    assert.equal(v2d.status, "DRAFT");

    const active = svc.resolveActiveDistribution(editionId);
    assert.equal(active?.allocations[0]?.paymentConnectionId, "acc_owner_live");
  });
});
