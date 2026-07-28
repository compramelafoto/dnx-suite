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
  if (!agreement || agreement.status !== "ACTIVE" || !agreement.currentVersionId) {
    return null;
  }
  const version = await prisma.dnxDistributionVersion.findUnique({
    where: { id: agreement.currentVersionId },
  });
  if (!version || version.status !== "PUBLISHED") return null;
  return mapVersionView(editionId, agreement, version);
}

export async function createEditionDraftDistribution(
  actor: FinanceActor,
  input: {
    editionId: string;
    name: string;
    allocations: AllocationDraftInput[];
  },
): Promise<EditionFinancialDistributionView> {
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
    if (!identity) {
      throw new EditionFinanceError("NOT_FOUND", "Identidad financiera no encontrada.");
    }
    if (row.paymentConnectionId) {
      const account = await prisma.dnxPaymentAccount.findUnique({
        where: { id: row.paymentConnectionId },
      });
      if (!account || account.financialIdentityId !== row.financialIdentityId) {
        throw new EditionFinanceError(
          "INVALID_CONNECTION",
          "La conexión no pertenece al beneficiario.",
        );
      }
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
        paymentAccountId: row.paymentConnectionId ?? null,
        roleLabel: "ORGANIZER",
        status: "ACCEPTED",
        invitedByUserId: actor.userId,
        acceptedAt: new Date(),
      },
      update: {
        paymentAccountId: row.paymentConnectionId ?? null,
        status: "ACCEPTED",
      },
    });

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

export async function activateEditionDistribution(
  actor: FinanceActor,
  input: { editionId: string; versionId: string },
): Promise<EditionFinancialDistributionView> {
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
  return evaluateCommercialFinanceGate({
    mode: input.mode,
    distribution,
    dnxPaymentsReady: input.dnxPaymentsReady,
    webhookConfigured: input.webhookConfigured,
    hasActivePricePhase: input.hasActivePricePhase,
  });
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
    return existing.financialDistributionSnapshot as unknown as OrderFinanceSnapshot;
  }

  const distribution = await resolveActiveEditionDistribution(input.editionId);
  if (!distribution) {
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
