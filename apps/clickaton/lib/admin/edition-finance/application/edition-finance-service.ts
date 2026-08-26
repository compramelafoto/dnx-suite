import { randomBytes } from "node:crypto";
import {
  ARGENTINA_2026_FEE_POLICY,
  CLICKATON_PRODUCT_KEY,
  DEFAULT_ROUNDING_POLICY,
  EDITION_SCOPE_TYPE,
  PERCENTAGE_BPS_TOTAL,
} from "../constants";
import { evaluateCommercialFinanceGate, type GateMode } from "../domain/gate";
import { EditionFinanceError } from "../domain/errors";
import {
  resolvePublishedVersionForCharges,
  shouldFreezeParticipantAccountForDraft,
} from "../domain/resolve-published-for-charges";
import { buildOrderFinanceSnapshot } from "../domain/snapshot";
import type {
  EditionFinanceAuditView,
  EditionFinancialAllocationView,
  EditionFinancialDistributionView,
  OrderFinanceSnapshot,
  PaymentConnectionView,
} from "../domain/types";
import { validateAllocationDrafts, type AllocationDraftInput } from "../domain/validate-allocations";
import { bpsToPercent } from "../domain/rounding";
import {
  assertCanManageEditionFinancialDistribution,
  assertCanViewEditionFinancialDistribution,
  type FinanceActor,
} from "../permissions";

function id(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export type InMemoryFinanceIdentity = {
  id: string;
  ownerUserId: number;
  displayName: string;
  email: string | null;
};

export type InMemoryPaymentAccount = PaymentConnectionView & {
  financialIdentityId: string;
};

export type InMemoryParticipant = {
  id: string;
  agreementId: string;
  financialIdentityId: string;
  paymentAccountId: string | null;
  roleLabel: string;
  status: string;
  sortOrder: number;
};

export type InMemoryRule = {
  id: string;
  versionId: string;
  participantId: string;
  shareBps: number;
  priority: number;
};

export type InMemoryVersion = {
  id: string;
  agreementId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  roundingPolicy: string;
  feePolicy: string | null;
  publishedAt: Date | null;
  publishedByUserId: number | null;
  createdAt: Date;
};

export type InMemoryAgreement = {
  id: string;
  editionId: string;
  productKey: string;
  scopeType: string;
  scopeId: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "SUPERSEDED";
  currentVersionId: string | null;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InMemoryEditionFinanceStore = {
  agreements: Map<string, InMemoryAgreement>;
  versions: Map<string, InMemoryVersion>;
  participants: Map<string, InMemoryParticipant>;
  rules: Map<string, InMemoryRule>;
  identities: Map<string, InMemoryFinanceIdentity>;
  accounts: Map<string, InMemoryPaymentAccount>;
  audits: EditionFinanceAuditView[];
  /** Snapshots by registrationId */
  orderSnapshots: Map<string, OrderFinanceSnapshot>;
};

export function createInMemoryEditionFinanceStore(): InMemoryEditionFinanceStore {
  return {
    agreements: new Map(),
    versions: new Map(),
    participants: new Map(),
    rules: new Map(),
    identities: new Map(),
    accounts: new Map(),
    audits: [],
    orderSnapshots: new Map(),
  };
}

function mapStatus(
  agreementStatus: InMemoryAgreement["status"],
  versionStatus: InMemoryVersion["status"],
): EditionFinancialDistributionView["status"] {
  if (versionStatus === "PUBLISHED" && agreementStatus === "ACTIVE") return "ACTIVE";
  if (versionStatus === "SUPERSEDED" || agreementStatus === "SUPERSEDED") return "SUPERSEDED";
  return "DRAFT";
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}•••@${d}`;
}

export function createEditionFinanceService(store: InMemoryEditionFinanceStore) {
  function audit(
    editionId: string,
    action: string,
    actorUserId: number | null,
    extra?: Partial<EditionFinanceAuditView>,
  ) {
    store.audits.unshift({
      id: id("faud"),
      editionId,
      action,
      actorUserId,
      agreementId: extra?.agreementId ?? null,
      versionId: extra?.versionId ?? null,
      previousValue: extra?.previousValue ?? null,
      nextValue: extra?.nextValue ?? null,
      metadata: extra?.metadata ?? null,
      createdAt: new Date(),
    });
  }

  function buildView(agreement: InMemoryAgreement, version: InMemoryVersion): EditionFinancialDistributionView {
    const rules = [...store.rules.values()]
      .filter((r) => r.versionId === version.id)
      .sort((a, b) => a.priority - b.priority);
    const allocations: EditionFinancialAllocationView[] = rules.map((rule) => {
      const p = store.participants.get(rule.participantId);
      if (!p) {
        return {
          id: rule.participantId,
          beneficiaryUserId: null,
          beneficiaryDisplayName: "Beneficiario",
          beneficiaryEmailMasked: null,
          financialIdentityId: "",
          paymentConnectionId: null,
          paymentConnection: null,
          role: "OTHER",
          shareType: "PERCENTAGE" as const,
          shareValue: bpsToPercent(rule.shareBps),
          shareBps: rule.shareBps,
          sortOrder: rule.priority,
          participantStatus: "REMOVED",
        };
      }
      const identity = store.identities.get(p.financialIdentityId);
      const account = p.paymentAccountId
        ? store.accounts.get(p.paymentAccountId) ?? null
        : null;
      const shareBps = rule.shareBps;
      return {
        id: p.id,
        beneficiaryUserId: identity?.ownerUserId ?? null,
        beneficiaryDisplayName: identity?.displayName ?? "Beneficiario",
        beneficiaryEmailMasked: maskEmail(identity?.email ?? null),
        financialIdentityId: p.financialIdentityId,
        paymentConnectionId: p.paymentAccountId,
        paymentConnection: account
          ? {
              id: account.id,
              provider: account.provider,
              environment: account.environment,
              status: account.status,
              providerUserId: account.providerUserId,
              connectedAt: account.connectedAt,
              lastError: account.lastError,
              canReceivePayments: account.canReceivePayments,
            }
          : null,
        role: p.roleLabel,
        shareType: "PERCENTAGE",
        shareValue: bpsToPercent(shareBps),
        shareBps,
        sortOrder: p.sortOrder,
        participantStatus: p.status,
      };
    });

    return {
      id: agreement.id,
      editionId: agreement.editionId,
      versionId: version.id,
      version: version.versionNumber,
      status: mapStatus(agreement.status, version.status),
      versionStatus: version.status,
      agreementStatus: agreement.status,
      effectiveFrom: version.publishedAt,
      effectiveUntil: null,
      createdByUserId: agreement.createdByUserId,
      activatedByUserId: version.publishedByUserId,
      activatedAt: version.publishedAt,
      feePolicy: version.feePolicy,
      roundingPolicy: version.roundingPolicy,
      allocations,
      createdAt: agreement.createdAt,
      updatedAt: agreement.updatedAt,
    };
  }

  function getAgreementForEdition(editionId: string): InMemoryAgreement | null {
    return (
      [...store.agreements.values()].find(
        (a) =>
          a.editionId === editionId &&
          a.productKey === CLICKATON_PRODUCT_KEY &&
          a.scopeType === EDITION_SCOPE_TYPE,
      ) ?? null
    );
  }

  function upsertParticipantAndRule(
    agreementId: string,
    versionId: string,
    row: {
      financialIdentityId: string;
      paymentConnectionId?: string | null;
      role?: string;
      shareBps: number;
      sortOrder?: number;
    },
    actorUserId: number,
    editionId: string,
  ) {
    if (!store.identities.has(row.financialIdentityId)) {
      throw new EditionFinanceError(
        "NOT_FOUND",
        `Identidad financiera no encontrada: ${row.financialIdentityId}`,
      );
    }
    const account = row.paymentConnectionId
      ? store.accounts.get(row.paymentConnectionId)
      : null;
    if (row.paymentConnectionId && !account) {
      throw new EditionFinanceError(
        "MISSING_CONNECTION",
        "La conexión de pago indicada no existe.",
      );
    }
    if (account && account.financialIdentityId !== row.financialIdentityId) {
      throw new EditionFinanceError(
        "INVALID_CONNECTION",
        "La conexión no pertenece al beneficiario indicado.",
      );
    }

    let participant = [...store.participants.values()].find(
      (p) =>
        p.agreementId === agreementId &&
        p.financialIdentityId === row.financialIdentityId,
    );
    if (!participant) {
      participant = {
        id: id("ap"),
        agreementId,
        financialIdentityId: row.financialIdentityId,
        paymentAccountId: row.paymentConnectionId ?? null,
        roleLabel: row.role ?? "ORGANIZER",
        status: "ACCEPTED",
        sortOrder: row.sortOrder ?? 10,
      };
      store.participants.set(participant.id, participant);
      audit(editionId, "BENEFICIARY_ADDED", actorUserId, {
        agreementId,
        versionId,
        nextValue: {
          financialIdentityId: row.financialIdentityId,
          shareBps: row.shareBps,
          paymentConnectionId: row.paymentConnectionId ?? null,
        },
      });
    } else {
      const existingParticipant = participant;
      const writingVersion = store.versions.get(versionId);
      const agreement = store.agreements.get(agreementId);
      const publishedVersion = agreement?.currentVersionId
        ? store.versions.get(agreement.currentVersionId)
        : null;
      const participantUsedByPublished = Boolean(
        publishedVersion &&
          publishedVersion.status === "PUBLISHED" &&
          [...store.rules.values()].some(
            (r) =>
              r.versionId === publishedVersion.id &&
              r.participantId === existingParticipant.id,
          ),
      );
      const freeze = shouldFreezeParticipantAccountForDraft({
        writingVersionStatus: writingVersion?.status ?? "DRAFT",
        publishedVersionId: publishedVersion?.id ?? null,
        publishedVersionStatus: publishedVersion?.status ?? null,
        participantUsedByPublished,
      });
      if (!freeze) {
        existingParticipant.paymentAccountId = row.paymentConnectionId ?? null;
      }
      existingParticipant.roleLabel = row.role ?? existingParticipant.roleLabel;
      existingParticipant.sortOrder = row.sortOrder ?? existingParticipant.sortOrder;
      existingParticipant.status = "ACCEPTED";
      audit(editionId, "CONNECTION_SELECTED", actorUserId, {
        agreementId,
        versionId,
        nextValue: {
          financialIdentityId: row.financialIdentityId,
          paymentConnectionId: freeze
            ? existingParticipant.paymentAccountId
            : (row.paymentConnectionId ?? null),
          frozenForPublished: freeze,
        },
      });
    }

    const ruleId = id("rule");
    store.rules.set(ruleId, {
      id: ruleId,
      versionId,
      participantId: participant.id,
      shareBps: row.shareBps,
      priority: row.sortOrder ?? 100,
    });
  }

  return {
    listDistributions(actor: FinanceActor, editionId: string): EditionFinancialDistributionView[] {
      assertCanViewEditionFinancialDistribution(actor, editionId);
      const agreement = getAgreementForEdition(editionId);
      if (!agreement) return [];
      return [...store.versions.values()]
        .filter((v) => v.agreementId === agreement.id)
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map((v) => buildView(agreement, v));
    },

    getActiveDistribution(
      actor: FinanceActor | null,
      editionId: string,
    ): EditionFinancialDistributionView | null {
      if (actor) assertCanViewEditionFinancialDistribution(actor, editionId);
      const agreement = getAgreementForEdition(editionId);
      const versions = agreement
        ? [...store.versions.values()].filter((v) => v.agreementId === agreement.id)
        : [];
      const currentVersion = agreement?.currentVersionId
        ? (store.versions.get(agreement.currentVersionId) ?? null)
        : null;
      const picked = resolvePublishedVersionForCharges({
        agreement,
        currentVersion,
        versions,
      });
      if (!picked.ok) return null;
      return buildView(agreement!, picked.version);
    },

    /** Resolver sin auth (checkout / gates internos). */
    resolveActiveDistribution(editionId: string): EditionFinancialDistributionView | null {
      return this.getActiveDistribution(null, editionId);
    },

    createDraftDistribution(
      actor: FinanceActor,
      input: {
        editionId: string;
        name: string;
        allocations: AllocationDraftInput[];
        feePolicy?: string;
      },
    ): EditionFinancialDistributionView {
      assertCanManageEditionFinancialDistribution(actor, input.editionId);
      const { rows } = validateAllocationDrafts(input.allocations);

      let agreement = getAgreementForEdition(input.editionId);
      if (!agreement) {
        agreement = {
          id: id("ea"),
          editionId: input.editionId,
          productKey: CLICKATON_PRODUCT_KEY,
          scopeType: EDITION_SCOPE_TYPE,
          scopeId: input.editionId,
          name: input.name,
          status: "DRAFT",
          currentVersionId: null,
          createdByUserId: actor.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.agreements.set(agreement.id, agreement);
        audit(input.editionId, "DISTRIBUTION_CREATED", actor.userId, {
          agreementId: agreement.id,
          nextValue: { name: input.name },
        });
      } else if (agreement.status === "ACTIVE") {
        // Nueva versión DRAFT sobre acuerdo activo
      }

      const existingVersions = [...store.versions.values()].filter(
        (v) => v.agreementId === agreement!.id,
      );
      const draftOpen = existingVersions.find((v) => v.status === "DRAFT");
      if (draftOpen) {
        throw new EditionFinanceError(
          "ALREADY_EXISTS",
          "Ya existe una versión DRAFT. Editá esa versión o publicala antes de crear otra.",
          { versionId: draftOpen.id },
        );
      }

      const versionNumber =
        existingVersions.reduce((m, v) => Math.max(m, v.versionNumber), 0) + 1;
      const version: InMemoryVersion = {
        id: id("dv"),
        agreementId: agreement.id,
        versionNumber,
        status: "DRAFT",
        roundingPolicy: DEFAULT_ROUNDING_POLICY,
        feePolicy: input.feePolicy ?? ARGENTINA_2026_FEE_POLICY,
        publishedAt: null,
        publishedByUserId: null,
        createdAt: new Date(),
      };
      store.versions.set(version.id, version);

      for (const row of rows) {
        upsertParticipantAndRule(agreement.id, version.id, row, actor.userId, input.editionId);
      }

      agreement.updatedAt = new Date();
      audit(input.editionId, "VERSION_CREATED", actor.userId, {
        agreementId: agreement.id,
        versionId: version.id,
        nextValue: { versionNumber, totalBps: PERCENTAGE_BPS_TOTAL },
      });
      return buildView(agreement, version);
    },

    updateDraftAllocations(
      actor: FinanceActor,
      input: {
        editionId: string;
        versionId: string;
        allocations: AllocationDraftInput[];
      },
    ): EditionFinancialDistributionView {
      assertCanManageEditionFinancialDistribution(actor, input.editionId);
      const version = store.versions.get(input.versionId);
      if (!version) throw new EditionFinanceError("NOT_FOUND", "Versión no encontrada.");
      if (version.status !== "DRAFT") {
        throw new EditionFinanceError(
          "IMMUTABLE",
          "Solo se puede editar una versión DRAFT. Creá una nueva versión.",
        );
      }
      const agreement = store.agreements.get(version.agreementId);
      if (!agreement || agreement.editionId !== input.editionId) {
        throw new EditionFinanceError("NOT_FOUND", "Acuerdo no encontrado.");
      }

      const previous = buildView(agreement, version);
      const { rows } = validateAllocationDrafts(input.allocations);

      for (const [rid, r] of store.rules) {
        if (r.versionId === version.id) store.rules.delete(rid);
      }

      for (const row of rows) {
        upsertParticipantAndRule(
          agreement.id,
          version.id,
          row,
          actor.userId,
          input.editionId,
        );
      }

      agreement.updatedAt = new Date();
      const next = buildView(agreement, version);
      audit(input.editionId, "PERCENTAGES_MODIFIED", actor.userId, {
        agreementId: agreement.id,
        versionId: version.id,
        previousValue: {
          allocations: previous.allocations.map((a) => ({
            id: a.financialIdentityId,
            shareBps: a.shareBps,
          })),
        },
        nextValue: {
          allocations: next.allocations.map((a) => ({
            id: a.financialIdentityId,
            shareBps: a.shareBps,
          })),
        },
      });
      return next;
    },

    activateDistribution(
      actor: FinanceActor,
      input: { editionId: string; versionId: string; requireValidConnections?: boolean },
    ): EditionFinancialDistributionView {
      assertCanManageEditionFinancialDistribution(actor, input.editionId);
      const version = store.versions.get(input.versionId);
      if (!version) throw new EditionFinanceError("NOT_FOUND", "Versión no encontrada.");
      if (version.status !== "DRAFT") {
        throw new EditionFinanceError("IMMUTABLE", "Solo se puede activar una versión DRAFT.");
      }
      const agreement = store.agreements.get(version.agreementId);
      if (!agreement || agreement.editionId !== input.editionId) {
        throw new EditionFinanceError("NOT_FOUND", "Acuerdo no encontrado.");
      }

      const draftView = buildView(agreement, version);
      const sum = draftView.allocations.reduce((s, a) => s + a.shareBps, 0);
      if (sum !== PERCENTAGE_BPS_TOTAL) {
        throw new EditionFinanceError(
          "INVALID_SHARE_SUM",
          "La suma debe ser exactamente 100% antes de activar.",
        );
      }

      if (input.requireValidConnections !== false) {
        for (const a of draftView.allocations) {
          if (!a.paymentConnection || !a.paymentConnection.canReceivePayments) {
            throw new EditionFinanceError(
              "MISSING_CONNECTION",
              `No se puede activar: ${a.beneficiaryDisplayName} sin conexión válida.`,
            );
          }
        }
      }

      // Supersede previous published
      for (const v of store.versions.values()) {
        if (v.agreementId === agreement.id && v.status === "PUBLISHED") {
          v.status = "SUPERSEDED";
        }
      }

      version.status = "PUBLISHED";
      version.publishedAt = new Date();
      version.publishedByUserId = actor.userId;
      agreement.status = "ACTIVE";
      agreement.currentVersionId = version.id;
      agreement.updatedAt = new Date();

      audit(input.editionId, "DISTRIBUTION_ACTIVATED", actor.userId, {
        agreementId: agreement.id,
        versionId: version.id,
        nextValue: { versionNumber: version.versionNumber },
      });
      return buildView(agreement, version);
    },

    evaluateGate(input: {
      editionId: string;
      mode: GateMode;
      dnxPaymentsReady?: boolean;
      webhookConfigured?: boolean;
      hasActivePricePhase?: boolean;
    }) {
      const distribution = this.resolveActiveDistribution(input.editionId);
      return evaluateCommercialFinanceGate({
        mode: input.mode,
        distribution,
        dnxPaymentsReady: input.dnxPaymentsReady,
        webhookConfigured: input.webhookConfigured,
        hasActivePricePhase: input.hasActivePricePhase,
      });
    },

    buildSnapshotForRegistration(input: {
      editionId: string;
      registrationId: string;
      currency: string;
      grossAmount: number;
      discountAmount: number;
      providerFee?: number;
      platformFee?: number;
    }): OrderFinanceSnapshot {
      const distribution = this.resolveActiveDistribution(input.editionId);
      if (!distribution) {
        throw new EditionFinanceError(
          "NO_ACTIVE_DISTRIBUTION",
          "No hay distribución ACTIVE para crear el snapshot de la orden.",
        );
      }
      const existing = store.orderSnapshots.get(input.registrationId);
      if (existing) return existing; // idempotent

      const snapshot = buildOrderFinanceSnapshot({
        distribution,
        currency: input.currency,
        grossAmount: input.grossAmount,
        discountAmount: input.discountAmount,
        providerFee: input.providerFee,
        platformFee: input.platformFee,
      });
      store.orderSnapshots.set(input.registrationId, snapshot);
      return snapshot;
    },

    getRegistrationSnapshot(registrationId: string): OrderFinanceSnapshot | null {
      return store.orderSnapshots.get(registrationId) ?? null;
    },

    listAudits(editionId: string): EditionFinanceAuditView[] {
      return store.audits.filter((a) => a.editionId === editionId);
    },
  };
}

export type EditionFinanceService = ReturnType<typeof createEditionFinanceService>;
