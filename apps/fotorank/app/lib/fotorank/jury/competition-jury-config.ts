/**
 * ETAPA 16A — Configuración de jurado competitivo por concurso.
 * Genérico (§10 master rules: FotoRank soporta otros concursos con modos distintos);
 * aplica defaults Clickatón solo cuando el concurso pertenece a ese canal/experiencia.
 */
import { randomBytes } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { JuryError } from "./errors";
import {
  CLICKATON_MIN_EVALUATIONS_PER_ENTRY,
  CLICKATON_MIN_VALID_ENTRIES,
  CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE,
} from "./clickaton-2026-rubric";

function newId() {
  return `fjc${randomBytes(12).toString("hex")}`;
}

export type CompetitionJuryConfigInput = {
  minimumValidEntriesForCompetition?: number | null;
  requiredEvaluationsPerEntry?: number;
  recommendedMaxEntriesPerJudge?: number;
  evaluationStartsAt?: Date | null;
  evaluationEndsAt?: Date | null;
  scoreScaleMin?: number;
  scoreScaleMax?: number;
  scoreIntegerOnly?: boolean;
  finalistsPerUnit?: number;
  publicVoteMode?: "DISABLED" | "JURY_ONLY" | "JURY_THEN_PUBLIC";
  criteriaConfigJson?: unknown;
  yellowLoadThreshold?: number;
  redLoadThreshold?: number;
};

/** true si el concurso es Clickatón (canal CLICKATON o maratón con canal clickaton). */
export function isClickatonJuryContest(contest: {
  distributionChannel?: string | null;
  experienceType?: string | null;
}): boolean {
  if (contest.distributionChannel === "CLICKATON") return true;
  return contest.experienceType === "MARATHON" && contest.distributionChannel === "CLICKATON";
}

function defaultsForContest(contest: { distributionChannel?: string | null; experienceType?: string | null }) {
  if (isClickatonJuryContest(contest)) {
    return {
      minimumValidEntriesForCompetition: CLICKATON_MIN_VALID_ENTRIES,
      requiredEvaluationsPerEntry: CLICKATON_MIN_EVALUATIONS_PER_ENTRY,
      recommendedMaxEntriesPerJudge: CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE,
    };
  }
  return {
    minimumValidEntriesForCompetition: null as number | null,
    requiredEvaluationsPerEntry: 3,
    recommendedMaxEntriesPerJudge: 500,
  };
}

/**
 * Devuelve la config existente o crea una nueva con defaults según canal/experiencia del concurso.
 * Idempotente (contestId es @unique).
 */
export async function getOrCreateCompetitionJuryConfig(contestId: string) {
  const existing = await prisma.fotorankCompetitionJuryConfig.findUnique({
    where: { contestId },
  });
  if (existing) return existing;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, distributionChannel: true, experienceType: true },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);

  const defaults = defaultsForContest(contest);

  return prisma.fotorankCompetitionJuryConfig.create({
    data: {
      id: newId(),
      contestId,
      minimumValidEntriesForCompetition: defaults.minimumValidEntriesForCompetition,
      requiredEvaluationsPerEntry: defaults.requiredEvaluationsPerEntry,
      recommendedMaxEntriesPerJudge: defaults.recommendedMaxEntriesPerJudge,
    },
  });
}

/**
 * Upsert explícito de configuración (organizador / super admin). No activa scoring por sí mismo.
 */
export async function upsertCompetitionJuryConfig(input: {
  contestId: string;
  actorUserId: number;
  config: CompetitionJuryConfigInput;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, organizationId: true, distributionChannel: true, experienceType: true },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);

  const c = input.config;
  if (c.scoreScaleMin != null && c.scoreScaleMax != null && c.scoreScaleMin >= c.scoreScaleMax) {
    throw new JuryError("INVALID_INPUT", "scoreScaleMin debe ser menor que scoreScaleMax.", 400);
  }
  if (c.requiredEvaluationsPerEntry != null && c.requiredEvaluationsPerEntry < 1) {
    throw new JuryError("INVALID_INPUT", "requiredEvaluationsPerEntry debe ser >= 1.", 400);
  }
  if (c.finalistsPerUnit != null && c.finalistsPerUnit < 1) {
    throw new JuryError("INVALID_INPUT", "finalistsPerUnit debe ser >= 1.", 400);
  }

  const existing = await prisma.fotorankCompetitionJuryConfig.findUnique({
    where: { contestId: input.contestId },
  });

  const data = {
    minimumValidEntriesForCompetition: c.minimumValidEntriesForCompetition ?? undefined,
    requiredEvaluationsPerEntry: c.requiredEvaluationsPerEntry ?? undefined,
    recommendedMaxEntriesPerJudge: c.recommendedMaxEntriesPerJudge ?? undefined,
    evaluationStartsAt: c.evaluationStartsAt ?? undefined,
    evaluationEndsAt: c.evaluationEndsAt ?? undefined,
    scoreScaleMin: c.scoreScaleMin ?? undefined,
    scoreScaleMax: c.scoreScaleMax ?? undefined,
    scoreIntegerOnly: c.scoreIntegerOnly ?? undefined,
    finalistsPerUnit: c.finalistsPerUnit ?? undefined,
    publicVoteMode: c.publicVoteMode ?? undefined,
    criteriaConfigJson:
      c.criteriaConfigJson === undefined
        ? undefined
        : c.criteriaConfigJson === null
          ? Prisma.JsonNull
          : (c.criteriaConfigJson as Prisma.InputJsonValue),
    yellowLoadThreshold: c.yellowLoadThreshold ?? undefined,
    redLoadThreshold: c.redLoadThreshold ?? undefined,
  };

  if (existing) {
    const updated = await prisma.fotorankCompetitionJuryConfig.update({
      where: { contestId: input.contestId },
      data,
    });
    await writeConfigAudit(contest.organizationId, input.contestId, input.actorUserId, "UPDATED", updated);
    return updated;
  }

  const defaults = defaultsForContest(contest);
  const created = await prisma.fotorankCompetitionJuryConfig.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      minimumValidEntriesForCompetition:
        c.minimumValidEntriesForCompetition ?? defaults.minimumValidEntriesForCompetition,
      requiredEvaluationsPerEntry: c.requiredEvaluationsPerEntry ?? defaults.requiredEvaluationsPerEntry,
      recommendedMaxEntriesPerJudge:
        c.recommendedMaxEntriesPerJudge ?? defaults.recommendedMaxEntriesPerJudge,
      evaluationStartsAt: c.evaluationStartsAt ?? null,
      evaluationEndsAt: c.evaluationEndsAt ?? null,
      scoreScaleMin: c.scoreScaleMin ?? 1,
      scoreScaleMax: c.scoreScaleMax ?? 10,
      scoreIntegerOnly: c.scoreIntegerOnly ?? true,
      finalistsPerUnit: c.finalistsPerUnit ?? 3,
      publicVoteMode: c.publicVoteMode ?? "DISABLED",
      criteriaConfigJson:
        c.criteriaConfigJson == null ? undefined : (c.criteriaConfigJson as Prisma.InputJsonValue),
      yellowLoadThreshold: c.yellowLoadThreshold ?? 501,
      redLoadThreshold: c.redLoadThreshold ?? 651,
    },
  });
  await writeConfigAudit(contest.organizationId, input.contestId, input.actorUserId, "CREATED", created);
  return created;
}

async function writeConfigAudit(
  organizationId: string,
  contestId: string,
  actorUserId: number,
  action: "CREATED" | "UPDATED",
  config: { id: string },
) {
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId,
      contestId,
      actorType: "ADMIN",
      actorUserId,
      eventType: `JURY_COMPETITION_CONFIG_${action}`,
      entityType: "FotorankCompetitionJuryConfig",
      entityId: config.id,
      payloadJson: {},
    },
  });
}
