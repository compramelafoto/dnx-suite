/**
 * ETAPA 16B — Checklist previo a abrir jurado (§4, §6, §7 master rules;
 * ver también `docs/clickaton/pre-jury-readiness-checklist.md`, documental).
 * Solo lectura: no muta estado. `openJurySession` debe exigir READY_FOR_JURY antes de abrir.
 */
import { prisma } from "@repo/db";
import { getOrCreateCompetitionJuryConfig, isClickatonJuryContest } from "./competition-jury-config";

export type PreJuryReadinessReasonCode =
  | "CONTEST_NOT_FOUND"
  | "ELIGIBILITY_NOT_FROZEN"
  | "ADMISSION_BATCH_NOT_FROZEN"
  | "NO_ACCEPTED_JUDGES"
  | "STRUCTURAL_COVERAGE_IMPOSSIBLE"
  | "NO_ACTIVE_CRITERIA"
  | "SESSION_ALREADY_OPEN";

export type PreJuryReadinessCheck = {
  pass: boolean;
  detail?: Record<string, unknown>;
};

export type PreJuryReadinessResult = {
  status: "READY_FOR_JURY" | "BLOCKED";
  reasons: Array<{ code: PreJuryReadinessReasonCode; message: string }>;
  checks: Record<
    | "eligibilityFrozen"
    | "admissionBatchFrozen"
    | "acceptedJudges"
    | "structuralCoverage"
    | "criteriaConfigured"
    | "deadlinesConfigured"
    | "anonymizationPath"
    | "scoringNotAlreadyOpen",
    PreJuryReadinessCheck
  >;
};

export async function evaluatePreJuryReadiness(contestId: string): Promise<PreJuryReadinessResult> {
  const reasons: PreJuryReadinessResult["reasons"] = [];

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, distributionChannel: true, experienceType: true },
  });
  if (!contest) {
    return {
      status: "BLOCKED",
      reasons: [{ code: "CONTEST_NOT_FOUND", message: "Concurso no encontrado." }],
      checks: {
        eligibilityFrozen: { pass: false },
        admissionBatchFrozen: { pass: false },
        acceptedJudges: { pass: false },
        structuralCoverage: { pass: false },
        criteriaConfigured: { pass: false },
        deadlinesConfigured: { pass: false },
        anonymizationPath: { pass: false },
        scoringNotAlreadyOpen: { pass: false },
      },
    };
  }

  const config = await getOrCreateCompetitionJuryConfig(contestId);
  const isClickaton = isClickatonJuryContest(contest);

  // 1) Congelamiento de elegibilidad competitiva (§3 master rules — solo aplica a Clickatón/con mínimo).
  let eligibilityFrozenCheck: PreJuryReadinessCheck;
  if (config.minimumValidEntriesForCompetition == null) {
    eligibilityFrozenCheck = { pass: true, detail: { applicable: false, isClickaton } };
  } else {
    const freeze = await prisma.fotorankCompetitiveEligibilityFreeze.findFirst({
      where: { contestId, status: "ELIGIBILITY_FROZEN" },
      orderBy: { configVersion: "desc" },
    });
    eligibilityFrozenCheck = {
      pass: Boolean(freeze),
      detail: { applicable: true, freezeId: freeze?.id ?? null, eligibleCount: freeze?.eligibleCount ?? null },
    };
    if (!eligibilityFrozenCheck.pass) {
      reasons.push({
        code: "ELIGIBILITY_NOT_FROZEN",
        message: "La elegibilidad competitiva no está congelada. Ejecutá freezeCompetitiveEligibility antes de abrir jurado.",
      });
    }
  }

  // 2) Lote de admisión congelado (roster fuente para snapshots ciegos).
  const admissionBatch = await prisma.fotorankAdmissionBatch.findFirst({
    where: { contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
  });
  const admissionBatchFrozenCheck: PreJuryReadinessCheck = {
    pass: Boolean(admissionBatch),
    detail: { admissionBatchId: admissionBatch?.id ?? null },
  };
  if (!admissionBatchFrozenCheck.pass) {
    reasons.push({
      code: "ADMISSION_BATCH_NOT_FROZEN",
      message: "No hay un lote de admisión FROZEN. La congelación crea el roster del jurado (§4.1 master rules).",
    });
  }

  // 3) Jurados con invitación aceptada (§6 master rules: "cuenta como disponible solo con invitación aceptada").
  const acceptedJudgeAccountIds = admissionBatch
    ? await prisma.fotorankJudgeAssignment.findMany({
        where: {
          contestId,
          assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED"] },
        },
        select: { judgeAccountId: true },
        distinct: ["judgeAccountId"],
      })
    : [];
  const acceptedJudgesCheck: PreJuryReadinessCheck = {
    pass: acceptedJudgeAccountIds.length > 0,
    detail: { acceptedJudgeCount: acceptedJudgeAccountIds.length },
  };
  if (!acceptedJudgesCheck.pass) {
    reasons.push({
      code: "NO_ACCEPTED_JUDGES",
      message: "No hay jurados con invitación ACEPTADA asignados a este concurso.",
    });
  }

  // 4) Cobertura estructural posible: entries * N evaluaciones <= judges * carga recomendada (no bloqueante
  // salvo que sea matemáticamente imposible incluso con la carga máxima admitida).
  const totalEntries = admissionBatch
    ? await prisma.fotorankJuryEntrySnapshot.count({ where: { admissionBatchId: admissionBatch.id } })
    : 0;
  const requiredEvaluationsPerEntry = config.requiredEvaluationsPerEntry;
  const recommendedMaxEntriesPerJudge = config.recommendedMaxEntriesPerJudge;
  const totalEvaluationUnitsNeeded = totalEntries * requiredEvaluationsPerEntry;
  const theoreticalCapacity = acceptedJudgeAccountIds.length * recommendedMaxEntriesPerJudge;
  const structurallyImpossible =
    acceptedJudgeAccountIds.length > 0 && totalEntries > 0 && theoreticalCapacity < totalEvaluationUnitsNeeded;
  const structuralCoverageCheck: PreJuryReadinessCheck = {
    pass: !structurallyImpossible,
    detail: {
      totalEntries,
      requiredEvaluationsPerEntry,
      acceptedJudgeCount: acceptedJudgeAccountIds.length,
      recommendedMaxEntriesPerJudge,
      totalEvaluationUnitsNeeded,
      theoreticalCapacity,
    },
  };
  if (structurallyImpossible) {
    reasons.push({
      code: "STRUCTURAL_COVERAGE_IMPOSSIBLE",
      message:
        "La cobertura estructural es imposible con la carga recomendada actual (entries × evaluaciones requeridas > jurados × carga recomendada). Es una alerta de capacidad, no impide sumar más jurados.",
    });
  }

  // 5) Criterios configurados (rúbrica activa con criterios).
  const activeRubric = admissionBatch
    ? await prisma.fotorankJuryRubric.findFirst({
        where: { contestId, admissionBatchId: admissionBatch.id, status: "ACTIVE" },
        include: { criteria: true },
      })
    : null;
  const criteriaConfiguredCheck: PreJuryReadinessCheck = {
    pass: Boolean(activeRubric && activeRubric.criteria.length > 0),
    detail: { rubricId: activeRubric?.id ?? null, criteriaCount: activeRubric?.criteria.length ?? 0 },
  };
  if (!criteriaConfiguredCheck.pass) {
    reasons.push({
      code: "NO_ACTIVE_CRITERIA",
      message: "No hay una rúbrica ACTIVE con criterios. Activá la rúbrica antes de abrir jurado.",
    });
  }

  // 6) Deadlines (informativo — no bloquea abrir; §7.6 master rules permite configurarlos luego).
  const deadlinesConfiguredCheck: PreJuryReadinessCheck = {
    pass: true,
    detail: {
      evaluationStartsAt: config.evaluationStartsAt,
      evaluationEndsAt: config.evaluationEndsAt,
      configured: Boolean(config.evaluationStartsAt && config.evaluationEndsAt),
    },
  };

  // 7) Camino de anonimización: snapshots ciegos existen con código anónimo (sin PII expuesta al jurado).
  const anonymizedSnapshotCount = admissionBatch
    ? await prisma.fotorankJuryEntrySnapshot.count({
        where: { admissionBatchId: admissionBatch.id, anonymousCode: { not: "" } },
      })
    : 0;
  const anonymizationPathCheck: PreJuryReadinessCheck = {
    pass: Boolean(admissionBatch) && anonymizedSnapshotCount === totalEntries && totalEntries > 0,
    detail: { anonymizedSnapshotCount, totalEntries },
  };
  if (!anonymizationPathCheck.pass && admissionBatch) {
    reasons.push({
      code: "ADMISSION_BATCH_NOT_FROZEN",
      message: "Los snapshots ciegos del lote de admisión no cubren todas las obras. Revisá la congelación del lote.",
    });
  }

  // 8) scoringEnabled debe seguir false hasta abrir (evita doble apertura / drift de estado).
  const openSession = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId, status: "OPEN" },
    select: { id: true },
  });
  const scoringNotAlreadyOpenCheck: PreJuryReadinessCheck = {
    pass: !openSession,
    detail: { openSessionId: openSession?.id ?? null },
  };
  if (!scoringNotAlreadyOpenCheck.pass) {
    reasons.push({
      code: "SESSION_ALREADY_OPEN",
      message: "Ya hay una sesión de jurado OPEN para este concurso.",
    });
  }

  return {
    status: reasons.length === 0 ? "READY_FOR_JURY" : "BLOCKED",
    reasons,
    checks: {
      eligibilityFrozen: eligibilityFrozenCheck,
      admissionBatchFrozen: admissionBatchFrozenCheck,
      acceptedJudges: acceptedJudgesCheck,
      structuralCoverage: structuralCoverageCheck,
      criteriaConfigured: criteriaConfiguredCheck,
      deadlinesConfigured: deadlinesConfiguredCheck,
      anonymizationPath: anonymizationPathCheck,
      scoringNotAlreadyOpen: scoringNotAlreadyOpenCheck,
    },
  };
}
