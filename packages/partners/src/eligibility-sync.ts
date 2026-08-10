import {
  buildAutomaticAccessKey,
  buildPendingAccessKey,
} from "./eligibility-access-key";
import { evaluateBenefitEligibility } from "./eligibility-evaluate";
import type {
  BenefitAccessSyncPlan,
  BenefitEligibilityEvaluation,
  BenefitForEligibility,
  ClickatonEligibilitySnapshot,
  SyncAccessPlanItem,
} from "./eligibility-types";
import type { BenefitAccessRecord } from "./types";

export function buildBenefitAccessSyncPlan(input: {
  benefit: BenefitForEligibility;
  snapshot: ClickatonEligibilitySnapshot;
  existingAccess: BenefitAccessRecord[];
  mode: "PREVIEW" | "APPLY";
  now?: Date;
}): BenefitAccessSyncPlan {
  const evaluation = evaluateBenefitEligibility({
    benefit: input.benefit,
    snapshot: input.snapshot,
    now: input.now,
  });
  return planFromEvaluation({
    evaluation,
    existingAccess: input.existingAccess,
    mode: input.mode,
  });
}

export function planFromEvaluation(input: {
  evaluation: BenefitEligibilityEvaluation;
  existingAccess: BenefitAccessRecord[];
  mode: "PREVIEW" | "APPLY";
}): BenefitAccessSyncPlan {
  const { evaluation, existingAccess, mode } = input;
  const errors: string[] = [];
  const toGrant: SyncAccessPlanItem[] = [];
  const toKeep: SyncAccessPlanItem[] = [];
  const toRevoke: SyncAccessPlanItem[] = [];
  const pendingIdentity: SyncAccessPlanItem[] = [];

  const canMaterialize = evaluation.benefitActive && evaluation.withinWindow;

  const desiredKeys = new Map<string, SyncAccessPlanItem>();

  if (canMaterialize) {
    for (const s of evaluation.materializableSubjects) {
      if (s.userId == null) continue;
      const accessKey = buildAutomaticAccessKey({
        benefitId: evaluation.benefitId,
        userId: s.userId,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
      });
      desiredKeys.set(accessKey, {
        action: "GRANT",
        accessKey,
        userId: s.userId,
        source: "AUTOMATIC",
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        reasonCode: s.reasonCode,
        status: "ACTIVE",
      });
    }
    for (const s of evaluation.pendingIdentity) {
      const accessKey = buildPendingAccessKey({
        benefitId: evaluation.benefitId,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
      });
      pendingIdentity.push({
        action: "SKIP_PENDING",
        accessKey,
        userId: null,
        source: "AUTOMATIC",
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        reasonCode: s.reasonCode,
        status: "PENDING_IDENTITY",
      });
    }
  }

  const existingByKey = new Map(existingAccess.map((a) => [a.accessKey, a]));

  for (const [key, desired] of desiredKeys) {
    const existing = existingByKey.get(key);
    if (existing && existing.status === "ACTIVE") {
      toKeep.push({
        ...desired,
        action: "KEEP",
        existingAccessId: existing.id,
      });
    } else {
      toGrant.push({
        ...desired,
        action: "GRANT",
        existingAccessId: existing?.id,
      });
    }
  }

  for (const existing of existingAccess) {
    if (existing.source !== "AUTOMATIC") continue;
    if (existing.status !== "ACTIVE") continue;
    if (desiredKeys.has(existing.accessKey)) continue;
    // No revocar manual; solo automático que dejó de ser elegible
    // o beneficio fuera de ventana / inactivo
    toRevoke.push({
      action: "REVOKE",
      accessKey: existing.accessKey,
      userId: existing.userId,
      source: "AUTOMATIC",
      sourceType: existing.sourceType,
      sourceId: existing.sourceId,
      reasonCode: canMaterialize ? "REGISTRATION_CANCELLED" : "BENEFIT_NOT_ACTIVE",
      status: "REVOKED",
      existingAccessId: existing.id,
    });
  }

  return {
    benefitId: evaluation.benefitId,
    editionId: evaluation.editionId,
    mode,
    evaluation,
    toGrant,
    toKeep,
    toRevoke,
    pendingIdentity,
    errors,
  };
}

export function summarizeSyncPlan(plan: BenefitAccessSyncPlan): {
  eligible: number;
  materializable: number;
  toGrant: number;
  toKeep: number;
  toRevoke: number;
  pendingIdentity: number;
  notEvaluable: number;
} {
  return {
    eligible: plan.evaluation.eligibleSubjects.length,
    materializable: plan.evaluation.materializableSubjects.length,
    toGrant: plan.toGrant.length,
    toKeep: plan.toKeep.length,
    toRevoke: plan.toRevoke.length,
    pendingIdentity: plan.pendingIdentity.length,
    notEvaluable: plan.evaluation.notEvaluableAudiences.length,
  };
}
