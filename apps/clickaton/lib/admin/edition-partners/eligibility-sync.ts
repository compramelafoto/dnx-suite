// @ts-nocheck — schema drift BenefitSyncRun/accessKey vs Prisma client (mismo caso adapter Partners)
import { prisma } from "@repo/db";
import {
  PartnersDomainError,
  assertPartnerCapability,
  buildBenefitAccessSyncPlan,
  summarizeSyncPlan,
  type BenefitAccessSyncPlan,
  type BenefitForEligibility,
  type PartnerActor,
} from "@repo/partners";
import { getClickatonPartnersService } from "@/lib/admin/partners/runtime";
import { loadClickatonEligibilitySnapshot } from "./eligibility-snapshot";

function logEligibility(event: string, data: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      scope: "dnx_partners_eligibility",
      event,
      ...data,
      ts: new Date().toISOString(),
    }),
  );
}

async function loadBenefitForEligibility(benefitId: string): Promise<BenefitForEligibility> {
  const benefit = await prisma.dnxPartnerBenefit.findUnique({
    where: { id: benefitId },
    include: { audiences: true },
  });
  if (!benefit) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
  return {
    id: benefit.id,
    partnerId: benefit.partnerId,
    participationId: benefit.participationId,
    status: benefit.status,
    startsAt: benefit.startsAt,
    endsAt: benefit.endsAt,
    archivedAt: benefit.archivedAt,
    audiences: benefit.audiences.map((a) => ({
      id: a.id,
      audienceType: a.audienceType,
      contextType: a.contextType,
      contextId: a.contextId,
      organizationId: a.organizationId,
      manualUserId: a.manualUserId,
      label: a.label,
      metadata:
        a.metadata && typeof a.metadata === "object" && !Array.isArray(a.metadata)
          ? (a.metadata as Record<string, unknown>)
          : null,
    })),
  };
}

async function assertBenefitInEdition(editionId: string, benefitId: string) {
  const row = await prisma.dnxPartnerBenefit.findUnique({
    where: { id: benefitId },
    include: { participation: true, audiences: true },
  });
  if (!row) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
  const tied =
    row.participation &&
    row.participation.application === "CLICKATON" &&
    ((row.participation.contextType === "EDITION" &&
      row.participation.contextId === editionId) ||
      row.participation.contextType === "CATEGORY" ||
      row.participation.contextType === "VENUE");
  const audienceEdition = row.audiences.some(
    (a) => a.contextType === "EDITION" && a.contextId === editionId,
  );
  if (!tied && !audienceEdition) {
    throw new PartnersDomainError("VALIDATION", "El beneficio no pertenece a esta edición.");
  }
  return row;
}

export async function previewBenefitAccessSync(input: {
  actor: PartnerActor;
  editionId: string;
  benefitId: string;
}): Promise<BenefitAccessSyncPlan> {
  assertPartnerCapability(input.actor, "PARTNER_BENEFITS_VIEW_ELIGIBILITY");
  await assertBenefitInEdition(input.editionId, input.benefitId);
  const svc = getClickatonPartnersService();
  const benefit = await loadBenefitForEligibility(input.benefitId);
  const snapshot = await loadClickatonEligibilitySnapshot(input.editionId);
  const existing = await svc.listBenefitAccess(input.actor, input.benefitId);
  const plan = buildBenefitAccessSyncPlan({
    benefit,
    snapshot,
    existingAccess: existing,
    mode: "PREVIEW",
  });
  const summary = summarizeSyncPlan(plan);
  logEligibility("preview", {
    benefitId: input.benefitId,
    editionId: input.editionId,
    actorUserId: input.actor.userId,
    ...summary,
  });
  await prisma.dnxPartnerBenefitSyncRun.create({
    data: {
      benefitId: input.benefitId,
      editionId: input.editionId,
      mode: "PREVIEW",
      status: "COMPLETED",
      actorUserId: input.actor.userId,
      summaryJson: summary,
      finishedAt: new Date(),
    },
  });
  await prisma.dnxPartnerAuditEvent.create({
    data: {
      partnerId: benefit.partnerId,
      entityType: "DnxPartnerBenefit",
      entityId: benefit.id,
      action: "eligibility.preview",
      actorUserId: input.actor.userId,
      summary: `preview edition=${input.editionId}`,
      afterJson: summary,
    },
  });
  return plan;
}

export async function applyBenefitAccessSync(input: {
  actor: PartnerActor;
  editionId: string;
  benefitId: string;
}): Promise<BenefitAccessSyncPlan & { applied: boolean }> {
  assertPartnerCapability(input.actor, "PARTNER_BENEFITS_SYNC_ACCESS");
  await assertBenefitInEdition(input.editionId, input.benefitId);
  const svc = getClickatonPartnersService();
  const benefit = await loadBenefitForEligibility(input.benefitId);

  const other = await prisma.dnxPartnerBenefitSyncRun.findFirst({
    where: {
      benefitId: input.benefitId,
      mode: "APPLY",
      status: "RUNNING",
      startedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (other) {
    throw new PartnersDomainError(
      "CONFLICT",
      "Ya hay una sincronización en curso para este beneficio.",
    );
  }

  const run = await prisma.dnxPartnerBenefitSyncRun.create({
    data: {
      benefitId: input.benefitId,
      editionId: input.editionId,
      mode: "APPLY",
      status: "RUNNING",
      actorUserId: input.actor.userId,
    },
  });

  try {
    const snapshot = await loadClickatonEligibilitySnapshot(input.editionId);
    const existing = await svc.listBenefitAccess(input.actor, input.benefitId);
    const plan = buildBenefitAccessSyncPlan({
      benefit,
      snapshot,
      existingAccess: existing,
      mode: "APPLY",
    });

    for (const item of plan.toGrant) {
      if (item.userId == null) continue;
      await svc.grantBenefitAccess(input.actor, {
        benefitId: input.benefitId,
        userId: item.userId,
        source: "AUTOMATIC",
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        reasonCode: item.reasonCode,
        accessKey: item.accessKey,
        reason: item.reasonCode,
        notes: null,
      });
    }

    for (const item of plan.toRevoke) {
      if (!item.accessKey) continue;
      await svc.revokeBenefitAccessByAccessKey(input.actor, item.accessKey);
    }

    for (const item of plan.pendingIdentity) {
      await prisma.dnxPartnerBenefitAccess.upsert({
        where: { accessKey: item.accessKey },
        create: {
          accessKey: item.accessKey,
          benefitId: input.benefitId,
          userId: null,
          status: "PENDING_IDENTITY",
          source: "AUTOMATIC",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          reasonCode: item.reasonCode,
          reason: item.reasonCode,
        },
        update: {
          status: "PENDING_IDENTITY",
          reasonCode: item.reasonCode,
          revokedAt: null,
          revokedByUserId: null,
        },
      });
    }

    const summary = summarizeSyncPlan(plan);
    await prisma.dnxPartnerBenefitSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        summaryJson: summary,
      },
    });
    await prisma.dnxPartnerAuditEvent.create({
      data: {
        partnerId: benefit.partnerId,
        entityType: "DnxPartnerBenefit",
        entityId: benefit.id,
        action: "eligibility.sync_apply",
        actorUserId: input.actor.userId,
        summary: `apply edition=${input.editionId}`,
        afterJson: summary,
      },
    });
    logEligibility("apply_ok", {
      benefitId: input.benefitId,
      editionId: input.editionId,
      actorUserId: input.actor.userId,
      ...summary,
    });
    return { ...plan, applied: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    await prisma.dnxPartnerBenefitSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: message.slice(0, 500),
      },
    });
    logEligibility("apply_fail", {
      benefitId: input.benefitId,
      editionId: input.editionId,
      error: message.slice(0, 200),
    });
    throw err;
  }
}

export async function syncEditionBenefitAccess(input: {
  actor: PartnerActor;
  editionId: string;
}): Promise<{
  benefits: Array<{ benefitId: string; ok: boolean; summary?: unknown; error?: string }>;
}> {
  assertPartnerCapability(input.actor, "PARTNER_BENEFITS_SYNC_ACCESS");
  const participations = await prisma.dnxPartnerParticipation.findMany({
    where: {
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: input.editionId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });
  const benefits = await prisma.dnxPartnerBenefit.findMany({
    where: {
      participationId: { in: participations.map((p) => p.id) },
      status: "ACTIVE",
      archivedAt: null,
    },
    select: { id: true },
  });

  const results: Array<{ benefitId: string; ok: boolean; summary?: unknown; error?: string }> =
    [];
  for (const b of benefits) {
    try {
      const plan = await applyBenefitAccessSync({
        actor: input.actor,
        editionId: input.editionId,
        benefitId: b.id,
      });
      results.push({ benefitId: b.id, ok: true, summary: summarizeSyncPlan(plan) });
    } catch (err) {
      results.push({
        benefitId: b.id,
        ok: false,
        error: err instanceof Error ? err.message : "error",
      });
    }
  }

  await prisma.dnxPartnerAuditEvent.create({
    data: {
      partnerId: null,
      entityType: "ClickatonEdition",
      entityId: input.editionId,
      action: "eligibility.sync_edition",
      actorUserId: input.actor.userId,
      summary: `edition sync benefits=${results.length}`,
      afterJson: {
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      },
    },
  });

  return { benefits: results };
}
