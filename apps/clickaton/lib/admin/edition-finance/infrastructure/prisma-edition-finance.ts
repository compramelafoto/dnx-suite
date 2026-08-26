import { Prisma } from "@repo/db";
import { prisma } from "@/lib/admin/db";
import {
  ARGENTINA_2026_FEE_POLICY,
  CLICKATON_PRODUCT_KEY,
  DEFAULT_ROUNDING_POLICY,
  EDITION_SCOPE_TYPE,
  PERCENTAGE_BPS_TOTAL,
} from "../constants";
import { EditionFinanceError } from "../domain/errors";
import { evaluateCommercialFinanceGate, type GateMode } from "../domain/gate";
import { logFinanceOps } from "../domain/finance-ops-log";
import {
  resolvePublishedVersionForCharges,
  shouldFreezeParticipantAccountForDraft,
} from "../domain/resolve-published-for-charges";
import { buildOrderFinanceSnapshot } from "../domain/snapshot";
import { bpsToPercent } from "../domain/rounding";
import type {
  EditionFinanceAuditView,
  EditionFinancialDistributionView,
  OrderFinanceSnapshot,
} from "../domain/types";
import { validateAllocationDrafts, type AllocationDraftInput } from "../domain/validate-allocations";
import {
  assertCanManageEditionFinancialDistribution,
  assertCanMutateEditionFinancialDistribution,
  type FinanceActor,
} from "../permissions";

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}•••@${d}`;
}

async function writeAudit(input: {
  editionId: string;
  actorUserId: number | null;
  action: string;
  agreementId?: string | null;
  versionId?: string | null;
  previousValue?: unknown;
  nextValue?: unknown;
  metadata?: unknown;
}) {
  await prisma.clickatonEditionFinanceAudit.create({
    data: {
      editionId: input.editionId,
      actorUserId: input.actorUserId,
      action: input.action,
      agreementId: input.agreementId ?? null,
      versionId: input.versionId ?? null,
      previousValue:
        input.previousValue === undefined
          ? undefined
          : (input.previousValue as Prisma.InputJsonValue),
      nextValue:
        input.nextValue === undefined
          ? undefined
          : (input.nextValue as Prisma.InputJsonValue),
      metadata:
        input.metadata === undefined
          ? undefined
          : (input.metadata as Prisma.InputJsonValue),
    },
  });
}

async function getAgreement(editionId: string) {
  return prisma.dnxEconomicAgreement.findUnique({
    where: {
      productKey_scopeType_scopeId: {
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        scopeId: editionId,
      },
    },
  });
}

async function mapVersionView(
  editionId: string,
  agreement: {
    id: string;
    status: string;
    createdByUserId: number;
    createdAt: Date;
    updatedAt: Date;
    currentVersionId: string | null;
  },
  version: {
    id: string;
    versionNumber: number;
    status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
    roundingPolicy: string;
    feePolicy: string | null;
    publishedAt: Date | null;
    publishedByUserId: number | null;
    createdAt: Date;
  },
): Promise<EditionFinancialDistributionView> {
  const rules = await prisma.dnxDistributionRule.findMany({
    where: { distributionVersionId: version.id },
    include: {
      agreementParticipant: {
        include: {
          financialIdentity: {
            include: { ownerUser: { select: { id: true, email: true } } },
          },
          paymentAccount: true,
        },
      },
    },
    orderBy: { priority: "asc" },
  });

  const status =
    version.status === "PUBLISHED" && agreement.status === "ACTIVE"
      ? ("ACTIVE" as const)
      : version.status === "SUPERSEDED" || agreement.status === "SUPERSEDED"
        ? ("SUPERSEDED" as const)
        : ("DRAFT" as const);

  return {
    id: agreement.id,
    editionId,
    versionId: version.id,
    version: version.versionNumber,
    status,
    versionStatus: version.status,
    agreementStatus: agreement.status,
    effectiveFrom: version.publishedAt,
    effectiveUntil: null,
    createdByUserId: agreement.createdByUserId,
    activatedByUserId: version.publishedByUserId,
    activatedAt: version.publishedAt,
    feePolicy: version.feePolicy,
    roundingPolicy: version.roundingPolicy,
    allocations: rules.map((rule, index) => {
      const p = rule.agreementParticipant;
      const identity = p.financialIdentity;
      const account = p.paymentAccount;
      const shareBps = Number(rule.value);
      const canReceive =
        Boolean(account) &&
        account!.status === "ACTIVE" &&
        (account!.capabilities.includes("COLLECTOR") ||
          account!.capabilities.includes("SPLIT_RECEIVER") ||
          account!.capabilities.length === 0);
      return {
        id: p.id,
        beneficiaryUserId: identity.ownerUserId,
        beneficiaryDisplayName:
          identity.legalName?.trim() ||
          identity.ownerUser?.email ||
          "Beneficiario",
        beneficiaryEmailMasked: maskEmail(identity.ownerUser?.email),
        financialIdentityId: identity.id,
        paymentConnectionId: p.paymentAccountId,
        paymentConnection: account
          ? {
              id: account.id,
              provider: account.provider,
              environment: account.environment === "PROD" ? "LIVE" : account.environment,
              status: account.status,
              providerUserId: account.providerUserId,
              connectedAt: account.connectedAt ?? account.updatedAt,
              lastError: account.status === "NEEDS_REAUTH" ? "Requiere reautorización" : null,
              canReceivePayments: canReceive,
            }
          : null,
        role: p.roleLabel,
        shareType: "PERCENTAGE" as const,
        shareValue: bpsToPercent(shareBps),
        shareBps,
        sortOrder: rule.priority || (index + 1) * 10,
        participantStatus: p.status,
      };
    }),
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
  };
}

export async function listEditionDistributions(
  _actor: FinanceActor,
  editionId: string,
): Promise<EditionFinancialDistributionView[]> {
  // Lectura: cualquier admin Clickatón (gate en page). Mutación usa assertCanManage.
  void _actor;
  const agreement = await getAgreement(editionId);
  if (!agreement) return [];
  const versions = await prisma.dnxDistributionVersion.findMany({
    where: { agreementId: agreement.id },
    orderBy: { versionNumber: "desc" },
  });
  return Promise.all(versions.map((v) => mapVersionView(editionId, agreement, v)));
}

export async function resolveActiveEditionDistribution(
  editionId: string,
): Promise<EditionFinancialDistributionView | null> {
  const agreement = await getAgreement(editionId);
  const versions = agreement
    ? await prisma.dnxDistributionVersion.findMany({
        where: { agreementId: agreement.id },
        orderBy: { versionNumber: "desc" },
      })
    : [];
  const currentVersion = agreement?.currentVersionId
    ? (versions.find((v) => v.id === agreement.currentVersionId) ??
      (await prisma.dnxDistributionVersion.findUnique({
        where: { id: agreement.currentVersionId },
      })))
    : null;

  const picked = resolvePublishedVersionForCharges({
    agreement,
    currentVersion,
    versions,
  });

  if (!picked.ok) {
    logFinanceOps({
      event: "finance_active_distribution_missing",
      editionId,
      agreementId: agreement?.id ?? null,
      agreementStatus: agreement?.status ?? null,
      distributionVersionId: currentVersion?.id ?? null,
      distributionVersionNumber: currentVersion?.versionNumber ?? null,
      versionStatus: currentVersion?.status ?? null,
      reason: picked.reason,
    });
    return null;
  }

  logFinanceOps({
    event: "finance_active_distribution_resolved",
    editionId,
    agreementId: agreement!.id,
    agreementStatus: agreement!.status,
    distributionVersionId: picked.version.id,
    distributionVersionNumber: picked.version.versionNumber,
    versionStatus: picked.version.status,
    reason: picked.reason,
    meta: { usedFallback: picked.usedFallback },
  });

  return mapVersionView(editionId, agreement!, picked.version);
}

async function participantUsedByPublishedVersion(
  publishedVersionId: string,
  participantId: string,
): Promise<boolean> {
  const rule = await prisma.dnxDistributionRule.findFirst({
    where: {
      distributionVersionId: publishedVersionId,
      agreementParticipantId: participantId,
    },
    select: { id: true },
  });
  return Boolean(rule);
}

export async function createEditionDraftDistribution(
  actor: FinanceActor,
  input: {
    editionId: string;
    name: string;
    allocations: AllocationDraftInput[];
  },
): Promise<EditionFinancialDistributionView> {
  assertCanMutateEditionFinancialDistribution(actor);
  assertCanManageEditionFinancialDistribution(actor, input.editionId);
  const { rows } = validateAllocationDrafts(input.allocations);

  let agreement = await getAgreement(input.editionId);
  if (!agreement) {
    agreement = await prisma.dnxEconomicAgreement.create({
      data: {
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        scopeId: input.editionId,
        name: input.name,
        countryCode: "AR",
        currency: "ARS",
        status: "DRAFT",
        createdByUserId: actor.userId,
      },
    });
    await writeAudit({
      editionId: input.editionId,
      actorUserId: actor.userId,
      action: "DISTRIBUTION_CREATED",
      agreementId: agreement.id,
      nextValue: { name: input.name },
    });
  }

  const openDraft = await prisma.dnxDistributionVersion.findFirst({
    where: { agreementId: agreement.id, status: "DRAFT" },
  });
  if (openDraft) {
    throw new EditionFinanceError(
      "ALREADY_EXISTS",
      "Ya existe una versión DRAFT. Editála o publicala antes de crear otra.",
      { versionId: openDraft.id },
    );
  }

  const max = await prisma.dnxDistributionVersion.aggregate({
    where: { agreementId: agreement.id },
    _max: { versionNumber: true },
  });
  const versionNumber = (max._max.versionNumber ?? 0) + 1;

  const version = await prisma.dnxDistributionVersion.create({
    data: {
      agreementId: agreement.id,
      versionNumber,
      status: "DRAFT",
      roundingPolicy: DEFAULT_ROUNDING_POLICY,
      feePolicy: ARGENTINA_2026_FEE_POLICY,
    },
  });

  for (const row of rows) {
    const identity = await prisma.dnxFinancialIdentity.findUnique({
      where: { id: row.financialIdentityId },
    });
    if (!identity || identity.status !== "ACTIVE") {
      throw new EditionFinanceError(
        "NOT_FOUND",
        "Identidad financiera inexistente o inactiva.",
      );
    }
    if (!row.paymentConnectionId) {
      throw new EditionFinanceError(
        "INVALID_CONNECTION",
        "Cada recipient necesita una cuenta de cobro ACTIVE.",
      );
    }
    const account = await prisma.dnxPaymentAccount.findUnique({
      where: { id: row.paymentConnectionId },
    });
    if (!account || account.financialIdentityId !== row.financialIdentityId) {
      throw new EditionFinanceError(
        "INVALID_CONNECTION",
        "La conexión no pertenece al beneficiario.",
      );
    }
    if (account.status !== "ACTIVE") {
      throw new EditionFinanceError(
        "INVALID_CONNECTION",
        "La cuenta de cobro debe estar ACTIVE para guardar la allocation.",
      );
    }

    const participant = await prisma.dnxAgreementParticipant.upsert({
      where: {
        agreementId_financialIdentityId: {
          agreementId: agreement.id,
          financialIdentityId: row.financialIdentityId,
        },
      },
      create: {
        agreementId: agreement.id,
        financialIdentityId: row.financialIdentityId,
        paymentAccountId: row.paymentConnectionId,
        roleLabel: "ORGANIZER",
        status: "ACCEPTED",
        invitedByUserId: actor.userId,
        acceptedAt: new Date(),
      },
      update: {
        // Borrador: no pisar cuenta de participantes usados por la PUBLISHED vigente.
        status: "ACCEPTED",
      },
    });

    const publishedId =
      agreement.status === "ACTIVE" && agreement.currentVersionId
        ? agreement.currentVersionId
        : null;
    const publishedVersion =
      publishedId != null
        ? await prisma.dnxDistributionVersion.findUnique({ where: { id: publishedId } })
        : null;
    const freeze = shouldFreezeParticipantAccountForDraft({
      writingVersionStatus: "DRAFT",
      publishedVersionId: publishedId,
      publishedVersionStatus: publishedVersion?.status ?? null,
      participantUsedByPublished: publishedId
        ? await participantUsedByPublishedVersion(publishedId, participant.id)
        : false,
    });

    if (!freeze) {
      await prisma.dnxAgreementParticipant.update({
        where: { id: participant.id },
        data: { paymentAccountId: row.paymentConnectionId },
      });
    } else if (participant.paymentAccountId !== row.paymentConnectionId) {
      logFinanceOps({
        event: "finance_draft_account_mutation_skipped",
        editionId: input.editionId,
        agreementId: agreement.id,
        distributionVersionId: version.id,
        reason: "protect_published_participant_account",
        meta: {
          participantId: participant.id,
          requestedPaymentAccountId: row.paymentConnectionId,
          keptPaymentAccountId: participant.paymentAccountId,
        },
      });
    }

    await prisma.dnxDistributionRule.create({
      data: {
        distributionVersionId: version.id,
        agreementParticipantId: participant.id,
        kind: "PERCENTAGE",
        value: BigInt(row.shareBps),
        priority: row.sortOrder ?? 100,
      },
    });
  }

  await prisma.clickatonEdition.update({
    where: { id: input.editionId },
    data: {
      paymentBeneficiaryConfig: {
        agreementId: agreement.id,
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        policy: "edition_scoped_dnx",
      },
    },
  });

  await writeAudit({
    editionId: input.editionId,
    actorUserId: actor.userId,
    action: "VERSION_CREATED",
    agreementId: agreement.id,
    versionId: version.id,
    nextValue: { versionNumber, totalBps: PERCENTAGE_BPS_TOTAL },
  });

  return mapVersionView(input.editionId, agreement, version);
}

export async function updateDraftAllocations(
  actor: FinanceActor,
  input: {
    editionId: string;
    versionId: string;
    allocations: AllocationDraftInput[];
  },
): Promise<EditionFinancialDistributionView> {
  assertCanMutateEditionFinancialDistribution(actor);
  assertCanManageEditionFinancialDistribution(actor, input.editionId);
  const { rows } = validateAllocationDrafts(input.allocations);
  const version = await prisma.dnxDistributionVersion.findUnique({
    where: { id: input.versionId },
  });
  if (!version) throw new EditionFinanceError("NOT_FOUND", "Versión no encontrada.");
  if (version.status !== "DRAFT") {
    throw new EditionFinanceError(
      "IMMUTABLE",
      "Solo se puede editar una versión DRAFT. Creá una nueva versión.",
    );
  }
  const agreement = await prisma.dnxEconomicAgreement.findUnique({
    where: { id: version.agreementId },
  });
  if (!agreement || agreement.scopeId !== input.editionId) {
    throw new EditionFinanceError("NOT_FOUND", "Acuerdo no encontrado.");
  }

  const previous = await mapVersionView(input.editionId, agreement, version);

  const publishedId =
    agreement.status === "ACTIVE" && agreement.currentVersionId
      ? agreement.currentVersionId
      : null;
  const publishedVersion =
    publishedId != null
      ? await prisma.dnxDistributionVersion.findUnique({ where: { id: publishedId } })
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.dnxDistributionRule.deleteMany({
      where: { distributionVersionId: version.id },
    });
    for (const row of rows) {
      const identity = await tx.dnxFinancialIdentity.findUnique({
        where: { id: row.financialIdentityId },
      });
      if (!identity || identity.status !== "ACTIVE") {
        throw new EditionFinanceError(
          "NOT_FOUND",
          "Identidad financiera inexistente o inactiva.",
        );
      }
      if (!row.paymentConnectionId) {
        throw new EditionFinanceError(
          "INVALID_CONNECTION",
          "Cada recipient necesita una cuenta de cobro ACTIVE.",
        );
      }
      const account = await tx.dnxPaymentAccount.findUnique({
        where: { id: row.paymentConnectionId },
      });
      if (!account || account.financialIdentityId !== row.financialIdentityId) {
        throw new EditionFinanceError(
          "INVALID_CONNECTION",
          "La conexión no pertenece al beneficiario.",
        );
      }
      if (account.status !== "ACTIVE") {
        throw new EditionFinanceError(
          "INVALID_CONNECTION",
          "La cuenta de cobro debe estar ACTIVE para guardar la allocation.",
        );
      }
      const participant = await tx.dnxAgreementParticipant.upsert({
        where: {
          agreementId_financialIdentityId: {
            agreementId: agreement.id,
            financialIdentityId: row.financialIdentityId,
          },
        },
        create: {
          agreementId: agreement.id,
          financialIdentityId: row.financialIdentityId,
          paymentAccountId: row.paymentConnectionId,
          roleLabel: "ORGANIZER",
          status: "ACCEPTED",
          invitedByUserId: actor.userId,
          acceptedAt: new Date(),
        },
        update: {
          status: "ACCEPTED",
        },
      });

      let usedByPublished = false;
      if (publishedId) {
        const rule = await tx.dnxDistributionRule.findFirst({
          where: {
            distributionVersionId: publishedId,
            agreementParticipantId: participant.id,
          },
          select: { id: true },
        });
        usedByPublished = Boolean(rule);
      }
      const freeze = shouldFreezeParticipantAccountForDraft({
        writingVersionStatus: "DRAFT",
        publishedVersionId: publishedId,
        publishedVersionStatus: publishedVersion?.status ?? null,
        participantUsedByPublished: usedByPublished,
      });

      if (!freeze) {
        await tx.dnxAgreementParticipant.update({
          where: { id: participant.id },
          data: { paymentAccountId: row.paymentConnectionId },
        });
      } else if (participant.paymentAccountId !== row.paymentConnectionId) {
        logFinanceOps({
          event: "finance_draft_account_mutation_skipped",
          editionId: input.editionId,
          agreementId: agreement.id,
          distributionVersionId: version.id,
          reason: "protect_published_participant_account",
          meta: {
            participantId: participant.id,
            requestedPaymentAccountId: row.paymentConnectionId,
            keptPaymentAccountId: participant.paymentAccountId,
          },
        });
      }

      await tx.dnxDistributionRule.create({
        data: {
          distributionVersionId: version.id,
          agreementParticipantId: participant.id,
          kind: "PERCENTAGE",
          value: BigInt(row.shareBps),
          priority: row.sortOrder ?? 100,
        },
      });
    }
  });

  await writeAudit({
    editionId: input.editionId,
    actorUserId: actor.userId,
    action: "PERCENTAGES_MODIFIED",
    agreementId: agreement.id,
    versionId: version.id,
    previousValue: {
      allocations: previous.allocations.map((a) => ({
        id: a.financialIdentityId,
        shareBps: a.shareBps,
      })),
    },
    nextValue: {
      allocations: rows.map((r) => ({
        id: r.financialIdentityId,
        shareBps: r.shareBps,
      })),
    },
  });

  const refreshed = await prisma.dnxDistributionVersion.findUniqueOrThrow({
    where: { id: version.id },
  });
  return mapVersionView(input.editionId, agreement, refreshed);
}

export async function activateEditionDistribution(
  actor: FinanceActor,
  input: { editionId: string; versionId: string },
): Promise<EditionFinancialDistributionView> {
  assertCanMutateEditionFinancialDistribution(actor);
  assertCanManageEditionFinancialDistribution(actor, input.editionId);
  const version = await prisma.dnxDistributionVersion.findUnique({
    where: { id: input.versionId },
  });
  if (!version) throw new EditionFinanceError("NOT_FOUND", "Versión no encontrada.");
  if (version.status !== "DRAFT") {
    throw new EditionFinanceError("IMMUTABLE", "Solo se puede activar una versión DRAFT.");
  }
  const agreement = await prisma.dnxEconomicAgreement.findUnique({
    where: { id: version.agreementId },
  });
  if (!agreement || agreement.scopeId !== input.editionId) {
    throw new EditionFinanceError("NOT_FOUND", "Acuerdo no encontrado.");
  }

  const view = await mapVersionView(input.editionId, agreement, version);
  if (view.allocations.reduce((s, a) => s + a.shareBps, 0) !== PERCENTAGE_BPS_TOTAL) {
    throw new EditionFinanceError("INVALID_SHARE_SUM", "La suma debe ser 100%.");
  }
  for (const a of view.allocations) {
    if (!a.paymentConnection?.canReceivePayments) {
      throw new EditionFinanceError(
        "MISSING_CONNECTION",
        `No se puede activar: ${a.beneficiaryDisplayName} sin conexión válida.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.dnxDistributionVersion.updateMany({
      where: { agreementId: agreement.id, status: "PUBLISHED" },
      data: { status: "SUPERSEDED" },
    });
    await tx.dnxDistributionVersion.update({
      where: { id: version.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedByUserId: actor.userId,
      },
    });
    await tx.dnxEconomicAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "ACTIVE",
        currentVersionId: version.id,
      },
    });
  });

  await writeAudit({
    editionId: input.editionId,
    actorUserId: actor.userId,
    action: "DISTRIBUTION_ACTIVATED",
    agreementId: agreement.id,
    versionId: version.id,
    nextValue: { versionNumber: version.versionNumber },
  });

  const refreshed = await prisma.dnxDistributionVersion.findUniqueOrThrow({
    where: { id: version.id },
  });
  const agr = await prisma.dnxEconomicAgreement.findUniqueOrThrow({
    where: { id: agreement.id },
  });
  return mapVersionView(input.editionId, agr, refreshed);
}

export async function evaluateEditionFinanceGate(input: {
  editionId: string;
  mode: GateMode;
  dnxPaymentsReady?: boolean;
  webhookConfigured?: boolean;
  hasActivePricePhase?: boolean;
}) {
  const distribution = await resolveActiveEditionDistribution(input.editionId);
  const result = evaluateCommercialFinanceGate({
    mode: input.mode,
    distribution,
    dnxPaymentsReady: input.dnxPaymentsReady,
    webhookConfigured: input.webhookConfigured,
    hasActivePricePhase: input.hasActivePricePhase,
  });
  logFinanceOps({
    event: "finance_gate_evaluated",
    editionId: input.editionId,
    agreementId: distribution?.id ?? null,
    distributionVersionId: distribution?.versionId ?? null,
    distributionVersionNumber: distribution?.version ?? null,
    versionStatus: distribution?.versionStatus ?? null,
    agreementStatus: distribution?.agreementStatus ?? null,
    ok: result.ok,
    mode: result.mode,
    blockers: result.blockers,
    reason: result.ok ? "gate_ok" : "gate_blocked",
  });
  return result;
}

export async function attachFinanceSnapshotToRegistration(input: {
  editionId: string;
  registrationId: string;
  currency: string;
  grossAmount: number;
  discountAmount: number;
  providerFee?: number;
  platformFee?: number;
}): Promise<OrderFinanceSnapshot> {
  const existing = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: { financialDistributionSnapshot: true },
  });
  if (existing?.financialDistributionSnapshot) {
    const snap = existing.financialDistributionSnapshot as unknown as OrderFinanceSnapshot;
    logFinanceOps({
      event: "finance_snapshot_attached",
      editionId: input.editionId,
      registrationId: input.registrationId,
      agreementId: snap.agreementId ?? snap.distributionId,
      distributionVersionId: snap.distributionVersionId,
      distributionVersionNumber: snap.distributionVersionNumber ?? snap.distributionVersion,
      reason: "reuse_existing_snapshot",
    });
    return snap;
  }

  const distribution = await resolveActiveEditionDistribution(input.editionId);
  if (!distribution) {
    logFinanceOps({
      event: "finance_snapshot_blocked",
      editionId: input.editionId,
      registrationId: input.registrationId,
      reason: "NO_ACTIVE_DISTRIBUTION",
    });
    throw new EditionFinanceError(
      "NO_ACTIVE_DISTRIBUTION",
      "No hay distribución ACTIVE para la orden.",
    );
  }

  const snapshot = buildOrderFinanceSnapshot({
    distribution,
    currency: input.currency,
    grossAmount: input.grossAmount,
    discountAmount: input.discountAmount,
    providerFee: input.providerFee,
    platformFee: input.platformFee,
  });

  await prisma.clickatonRegistration.update({
    where: { id: input.registrationId },
    data: {
      financialAgreementId: snapshot.distributionId,
      financialDistributionVersionId: snapshot.distributionVersionId,
      financialDistributionVersionNumber: snapshot.distributionVersion,
      financialDistributionSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  logFinanceOps({
    event: "finance_snapshot_attached",
    editionId: input.editionId,
    registrationId: input.registrationId,
    agreementId: snapshot.agreementId,
    distributionVersionId: snapshot.distributionVersionId,
    distributionVersionNumber: snapshot.distributionVersionNumber,
    versionStatus: distribution.versionStatus,
    reason: "attached_from_published",
    meta: {
      collectorPaymentAccountId: snapshot.allocations[0]?.paymentAccountId ?? null,
      allocationCount: snapshot.allocations.length,
    },
  });

  return snapshot;
}

export async function listEditionFinanceAudits(
  editionId: string,
): Promise<EditionFinanceAuditView[]> {
  const rows = await prisma.clickatonEditionFinanceAudit.findMany({
    where: { editionId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    editionId: r.editionId,
    action: r.action,
    actorUserId: r.actorUserId,
    agreementId: r.agreementId,
    versionId: r.versionId,
    previousValue: r.previousValue,
    nextValue: r.nextValue,
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));
}
