import { createHash } from "node:crypto";
import type { CurrencyCode } from "../contracts/primitives.js";
import {
  buildOrderDistributionSnapshot,
  toCompatibleDistributionSnapshotJson,
} from "../distribution/snapshot.js";
import type { RoundingPolicy } from "../distribution/types.js";
import {
  assertFinanceAction,
  type FinanceActor,
} from "../finance-permissions/index.js";
import {
  appendAudit,
  newId,
  type FinancialDomainStore,
} from "../financial-identity/memory-store.js";
import { EconomicAgreementError } from "./errors.js";
import {
  PERCENTAGE_BPS_TOTAL,
  type AgreementParticipant,
  type AgreementParticipantRoleLabel,
  type DistributionRuleKind,
  type DistributionRuleRecord,
  type DistributionVersion,
  type EconomicAgreement,
  type OrderDistributionSnapshot,
} from "./types.js";

const PUBLISHABLE_PARTICIPANT = new Set(["ACCEPTED", "ACTIVE"]);

export class EconomicAgreementService {
  constructor(private readonly store: FinancialDomainStore) {}

  createEconomicAgreement(
    actor: FinanceActor,
    input: {
      productKey: string;
      scopeType: string;
      scopeId: string;
      name: string;
      countryCode: string;
      currency: string;
    },
  ): EconomicAgreement {
    assertFinanceAction(actor, "create_agreement", {
      productKey: input.productKey,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
    });

    const duplicate = [...this.store.agreements.values()].find(
      (a) =>
        a.productKey === input.productKey &&
        a.scopeType === input.scopeType &&
        a.scopeId === input.scopeId,
    );
    if (duplicate) {
      throw new EconomicAgreementError(
        "AGREEMENT_EXISTS",
        "agreement already exists for product/scope",
      );
    }

    const now = new Date();
    const agreement: EconomicAgreement = {
      id: newId("ea"),
      productKey: input.productKey,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      countryCode: input.countryCode,
      currency: input.currency,
      status: "DRAFT",
      currentVersionId: null,
      createdByUserId: actor.userId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.agreements.set(agreement.id, agreement);
    appendAudit(this.store, {
      action: "economic_agreement.create",
      aggregateType: "EconomicAgreement",
      aggregateId: agreement.id,
      actorUserId: actor.userId,
      result: "SUCCEEDED",
      metadata: {
        productKey: agreement.productKey,
        scopeType: agreement.scopeType,
        scopeId: agreement.scopeId,
      },
    });
    return agreement;
  }

  inviteAgreementParticipant(
    actor: FinanceActor,
    input: {
      agreementId: string;
      financialIdentityId: string;
      roleLabel: AgreementParticipantRoleLabel;
    },
  ): AgreementParticipant {
    const agreement = this.requireAgreement(input.agreementId);
    assertFinanceAction(actor, "invite_participant", {
      productKey: agreement.productKey,
      scopeType: agreement.scopeType,
      scopeId: agreement.scopeId,
    });

    if (!this.store.identities.has(input.financialIdentityId)) {
      throw new EconomicAgreementError(
        "IDENTITY_NOT_FOUND",
        "financial identity not found",
      );
    }

    const existing = [...this.store.participants.values()].find(
      (p) =>
        p.agreementId === input.agreementId &&
        p.financialIdentityId === input.financialIdentityId,
    );
    if (existing) {
      throw new EconomicAgreementError(
        "PARTICIPANT_EXISTS",
        "identity already invited to agreement",
      );
    }

    const now = new Date();
    const participant: AgreementParticipant = {
      id: newId("ap"),
      agreementId: input.agreementId,
      financialIdentityId: input.financialIdentityId,
      paymentAccountId: null,
      roleLabel: input.roleLabel,
      status: "INVITED",
      validFrom: null,
      validTo: null,
      invitedByUserId: actor.userId,
      approvedByUserId: null,
      acceptedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.participants.set(participant.id, participant);
    return participant;
  }

  acceptAgreementParticipation(
    actor: FinanceActor,
    participantId: string,
  ): AgreementParticipant {
    const participant = this.requireParticipant(participantId);
    assertFinanceAction(actor, "accept_participation", {
      financialIdentityId: participant.financialIdentityId,
    });
    if (participant.status !== "INVITED") {
      throw new EconomicAgreementError(
        "INVALID_PARTICIPANT_STATUS",
        "only INVITED participants can accept",
      );
    }
    const now = new Date();
    const updated: AgreementParticipant = {
      ...participant,
      status: "ACCEPTED",
      acceptedAt: now,
      updatedAt: now,
    };
    this.store.participants.set(participantId, updated);
    return updated;
  }

  assignParticipantPaymentAccount(
    actor: FinanceActor,
    input: { participantId: string; paymentAccountId: string },
  ): AgreementParticipant {
    const participant = this.requireParticipant(input.participantId);
    assertFinanceAction(actor, "assign_own_payment_account", {
      financialIdentityId: participant.financialIdentityId,
    });
    const account = this.store.accounts.get(input.paymentAccountId);
    if (!account) {
      throw new EconomicAgreementError(
        "PAYMENT_ACCOUNT_NOT_FOUND",
        "payment account not found",
      );
    }
    if (account.financialIdentityId !== participant.financialIdentityId) {
      throw new EconomicAgreementError(
        "PAYMENT_ACCOUNT_IDENTITY_MISMATCH",
        "payment account must belong to participant identity",
      );
    }
    if (account.status !== "ACTIVE") {
      throw new EconomicAgreementError(
        "PAYMENT_ACCOUNT_NOT_ELIGIBLE",
        "payment account is not ACTIVE",
      );
    }

    const now = new Date();
    const updated: AgreementParticipant = {
      ...participant,
      paymentAccountId: input.paymentAccountId,
      status: participant.status === "ACCEPTED" ? "ACTIVE" : participant.status,
      updatedAt: now,
    };
    this.store.participants.set(participant.id, updated);
    return updated;
  }

  createDistributionDraft(
    actor: FinanceActor,
    agreementId: string,
    options?: { roundingPolicy?: RoundingPolicy; feePolicy?: string | null },
  ): DistributionVersion {
    const agreement = this.requireAgreement(agreementId);
    assertFinanceAction(actor, "publish_distribution", {
      productKey: agreement.productKey,
      scopeType: agreement.scopeType,
      scopeId: agreement.scopeId,
    });

    const maxVersion = Math.max(
      0,
      ...[...this.store.versions.values()]
        .filter((v) => v.agreementId === agreementId)
        .map((v) => v.versionNumber),
    );

    const version: DistributionVersion = {
      id: newId("dv"),
      agreementId,
      versionNumber: maxVersion + 1,
      status: "DRAFT",
      roundingPolicy: options?.roundingPolicy ?? "LARGEST_REMAINDER",
      feePolicy: options?.feePolicy ?? null,
      publishedAt: null,
      publishedByUserId: null,
      supersedesVersionId: agreement.currentVersionId,
      rulesHash: null,
      createdAt: new Date(),
    };
    this.store.versions.set(version.id, version);
    return version;
  }

  addOrUpdateDraftRule(input: {
    distributionVersionId: string;
    agreementParticipantId: string;
    kind: DistributionRuleKind;
    value: bigint | number;
    priority?: number;
    optional?: boolean;
  }): DistributionRuleRecord {
    const version = this.requireVersion(input.distributionVersionId);
    if (version.status !== "DRAFT") {
      throw new EconomicAgreementError(
        "VERSION_IMMUTABLE",
        "published versions are immutable",
      );
    }
    const participant = this.requireParticipant(input.agreementParticipantId);
    if (participant.agreementId !== version.agreementId) {
      throw new EconomicAgreementError(
        "PARTICIPANT_AGREEMENT_MISMATCH",
        "participant does not belong to agreement",
      );
    }

    const existing = [...this.store.rules.values()].find(
      (r) =>
        r.distributionVersionId === input.distributionVersionId &&
        r.agreementParticipantId === input.agreementParticipantId,
    );
    const value =
      typeof input.value === "bigint" ? input.value : BigInt(input.value);
    const now = new Date();
    if (existing) {
      const updated: DistributionRuleRecord = {
        ...existing,
        kind: input.kind,
        value,
        priority: input.priority ?? existing.priority,
        optional: input.optional ?? existing.optional,
      };
      this.store.rules.set(existing.id, updated);
      return updated;
    }
    const rule: DistributionRuleRecord = {
      id: newId("dr"),
      distributionVersionId: input.distributionVersionId,
      agreementParticipantId: input.agreementParticipantId,
      kind: input.kind,
      value,
      priority: input.priority ?? 100,
      optional: input.optional ?? false,
      createdAt: now,
    };
    this.store.rules.set(rule.id, rule);
    return rule;
  }

  validateDistributionVersion(versionId: string): {
    ok: true;
  } | {
    ok: false;
    code: string;
    message: string;
  } {
    try {
      this.assertPublishable(versionId);
      return { ok: true };
    } catch (err) {
      if (err instanceof EconomicAgreementError) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  }

  publishDistributionVersion(
    actor: FinanceActor,
    versionId: string,
  ): DistributionVersion {
    const version = this.requireVersion(versionId);
    const agreement = this.requireAgreement(version.agreementId);
    assertFinanceAction(actor, "publish_distribution", {
      productKey: agreement.productKey,
      scopeType: agreement.scopeType,
      scopeId: agreement.scopeId,
    });

    if (this.store.publishLocks.has(agreement.id)) {
      throw new EconomicAgreementError(
        "PUBLISH_IN_PROGRESS",
        "another publish is in progress for this agreement",
      );
    }
    this.store.publishLocks.add(agreement.id);
    try {
      if (version.status !== "DRAFT") {
        throw new EconomicAgreementError(
          "VERSION_NOT_DRAFT",
          "only DRAFT versions can be published",
        );
      }
      this.assertPublishable(versionId);

      const rules = this.rulesForVersion(versionId);
      const rulesHash = hashRules(rules);
      const now = new Date();

      if (agreement.currentVersionId) {
        const previous = this.requireVersion(agreement.currentVersionId);
        if (previous.status === "PUBLISHED") {
          this.store.versions.set(previous.id, {
            ...previous,
            status: "SUPERSEDED",
          });
        }
      }

      const published: DistributionVersion = {
        ...version,
        status: "PUBLISHED",
        publishedAt: now,
        publishedByUserId: actor.userId,
        rulesHash,
      };
      this.store.versions.set(version.id, published);
      this.store.agreements.set(agreement.id, {
        ...agreement,
        status: "ACTIVE",
        currentVersionId: version.id,
        updatedAt: now,
      });

      appendAudit(this.store, {
        action: "distribution_version.publish",
        aggregateType: "DistributionVersion",
        aggregateId: version.id,
        actorUserId: actor.userId,
        result: "SUCCEEDED",
        metadata: {
          agreementId: agreement.id,
          versionNumber: version.versionNumber,
          rulesHash,
          supersededVersionId: version.supersedesVersionId,
        },
      });
      return published;
    } finally {
      this.store.publishLocks.delete(agreement.id);
    }
  }

  getCurrentPublishedVersion(agreementId: string): DistributionVersion | null {
    const agreement = this.requireAgreement(agreementId);
    if (!agreement.currentVersionId) return null;
    const version = this.requireVersion(agreement.currentVersionId);
    return version.status === "PUBLISHED" ? version : null;
  }

  resolveAgreementForOrder(input: {
    productKey: string;
    scopeType: string;
    scopeId: string;
  }): EconomicAgreement | null {
    const agreement = [...this.store.agreements.values()].find(
      (a) =>
        a.productKey === input.productKey &&
        a.scopeType === input.scopeType &&
        a.scopeId === input.scopeId &&
        (a.status === "ACTIVE" || a.status === "DRAFT"),
    );
    return agreement ?? null;
  }

  buildAndPersistOrderSnapshot(input: {
    agreementId: string;
    totalMinor: bigint;
    externalReference?: string | null;
    paymentIntentId?: string | null;
    paymentOrderId?: string | null;
  }): {
    snapshot: OrderDistributionSnapshot;
    compatibleJson: Record<string, unknown>;
  } {
    const agreement = this.requireAgreement(input.agreementId);
    const version = this.getCurrentPublishedVersion(agreement.id);
    if (!version) {
      throw new EconomicAgreementError(
        "NO_PUBLISHED_VERSION",
        "agreement has no published distribution version",
      );
    }
    const participants = [...this.store.participants.values()].filter(
      (p) => p.agreementId === agreement.id,
    );
    const rules = this.rulesForVersion(version.id);
    const snapshot = buildOrderDistributionSnapshot({
      agreement,
      version,
      rules,
      participants,
      accountsById: this.store.accounts,
      totalMinor: input.totalMinor,
      currency: agreement.currency as CurrencyCode,
      externalReference: input.externalReference,
      paymentIntentId: input.paymentIntentId,
      paymentOrderId: input.paymentOrderId,
    });
    // Append-only: store a deep-frozen copy so later mutations cannot alter history.
    const immutable: OrderDistributionSnapshot = {
      ...snapshot,
      payload: {
        ...snapshot.payload,
        participants: snapshot.payload.participants.map((p) => ({ ...p })),
      },
    };
    Object.freeze(immutable.payload.participants);
    Object.freeze(immutable.payload);
    Object.freeze(immutable);
    this.store.snapshots.set(snapshot.id, immutable);
    return {
      snapshot,
      compatibleJson: toCompatibleDistributionSnapshotJson(snapshot),
    };
  }

  getSnapshot(id: string): OrderDistributionSnapshot {
    const snapshot = this.store.snapshots.get(id);
    if (!snapshot) {
      throw new EconomicAgreementError("SNAPSHOT_NOT_FOUND", "snapshot not found");
    }
    return snapshot;
  }

  markParticipantExited(participantId: string): AgreementParticipant {
    const participant = this.requireParticipant(participantId);
    const updated: AgreementParticipant = {
      ...participant,
      status: "EXITED",
      updatedAt: new Date(),
    };
    this.store.participants.set(participantId, updated);
    return updated;
  }

  private assertPublishable(versionId: string): void {
    const version = this.requireVersion(versionId);
    if (version.status !== "DRAFT") {
      throw new EconomicAgreementError(
        "VERSION_NOT_DRAFT",
        "only DRAFT versions can be validated for publish",
      );
    }
    const rules = this.rulesForVersion(versionId);
    if (rules.length === 0) {
      throw new EconomicAgreementError("NO_RULES", "version has no rules");
    }

    const percentageRules = rules.filter((r) => r.kind === "PERCENTAGE");
    const fixedRules = rules.filter((r) => r.kind === "FIXED");
    if (fixedRules.length === 0 && percentageRules.length > 0) {
      const sum = percentageRules.reduce((acc, r) => acc + Number(r.value), 0);
      if (sum !== PERCENTAGE_BPS_TOTAL) {
        throw new EconomicAgreementError(
          "PERCENTAGE_SUM_INVALID",
          `percentage rules must sum to ${PERCENTAGE_BPS_TOTAL} bps, got ${sum}`,
        );
      }
    }

    for (const rule of rules) {
      const participant = this.requireParticipant(rule.agreementParticipantId);
      if (participant.agreementId !== version.agreementId) {
        throw new EconomicAgreementError(
          "PARTICIPANT_AGREEMENT_MISMATCH",
          "rule participant outside agreement",
        );
      }
      if (!PUBLISHABLE_PARTICIPANT.has(participant.status)) {
        throw new EconomicAgreementError(
          "PARTICIPANT_NOT_READY",
          `participant ${participant.id} must be ACCEPTED or ACTIVE`,
        );
      }
      if (participant.roleLabel !== "PLATFORM" && !participant.paymentAccountId) {
        throw new EconomicAgreementError(
          "PAYMENT_ACCOUNT_REQUIRED",
          `participant ${participant.id} requires a payment account`,
        );
      }
      if (participant.paymentAccountId) {
        const account = this.store.accounts.get(participant.paymentAccountId);
        if (!account || account.status !== "ACTIVE") {
          throw new EconomicAgreementError(
            "PAYMENT_ACCOUNT_NOT_ELIGIBLE",
            "participant payment account is not ACTIVE",
          );
        }
        if (account.financialIdentityId !== participant.financialIdentityId) {
          throw new EconomicAgreementError(
            "PAYMENT_ACCOUNT_IDENTITY_MISMATCH",
            "participant payment account identity mismatch",
          );
        }
      }
    }
  }

  private rulesForVersion(versionId: string): DistributionRuleRecord[] {
    return [...this.store.rules.values()].filter(
      (r) => r.distributionVersionId === versionId,
    );
  }

  private requireAgreement(id: string): EconomicAgreement {
    const agreement = this.store.agreements.get(id);
    if (!agreement) {
      throw new EconomicAgreementError("AGREEMENT_NOT_FOUND", "agreement not found");
    }
    return agreement;
  }

  private requireParticipant(id: string): AgreementParticipant {
    const participant = this.store.participants.get(id);
    if (!participant) {
      throw new EconomicAgreementError(
        "PARTICIPANT_NOT_FOUND",
        "participant not found",
      );
    }
    return participant;
  }

  private requireVersion(id: string): DistributionVersion {
    const version = this.store.versions.get(id);
    if (!version) {
      throw new EconomicAgreementError("VERSION_NOT_FOUND", "version not found");
    }
    return version;
  }
}

function hashRules(rules: readonly DistributionRuleRecord[]): string {
  const canonical = JSON.stringify(
    [...rules]
      .map((r) => ({
        participantId: r.agreementParticipantId,
        kind: r.kind,
        value: r.value.toString(),
        priority: r.priority,
        optional: r.optional,
      }))
      .sort((a, b) => a.participantId.localeCompare(b.participantId)),
  );
  return createHash("sha256").update(canonical).digest("hex");
}
