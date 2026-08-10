/**
 * ETAPA 16B — Configuración de preparación de voto público (§9–§10 master rules).
 * Reutiliza `FotorankCompetitionJuryConfig` (sin tabla nueva). Modo: DISABLED | JURY_ONLY |
 * JURY_THEN_PUBLIC (campo `publicVoteMode` ya existente de ETAPA 16A). Nunca habilita
 * automatización comercial/redes (`publicVoteProvider` solo NONE en esta etapa; INSTAGRAM_FUTURE
 * queda modelado pero no implementado — §9.3 fuera de alcance).
 */
import { prisma, Prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertJuryActivationAllowed } from "./commercial-contest-guard";
import { getOrCreateCompetitionJuryConfig } from "./competition-jury-config";

const ALLOWED_MODES = new Set(["DISABLED", "JURY_ONLY", "JURY_THEN_PUBLIC"]);
const ALLOWED_UNITS = new Set(["PROMPT", "CATEGORY", "ENTRY", "ROUND"]);
const ALLOWED_PROVIDERS = new Set(["NONE", "INSTAGRAM_FUTURE"]);
const ALLOWED_STATUSES = new Set([
  "NOT_CONFIGURED",
  "READY",
  "SCHEDULED",
  "OPEN",
  "CLOSING",
  "PENDING_VERIFICATION",
  "CLOSED",
  "TIEBREAK_REQUIRED",
  "FINALIZED",
]);

export type PublicVoteConfigInput = {
  publicVoteMode?: "DISABLED" | "JURY_ONLY" | "JURY_THEN_PUBLIC";
  publicVoteEnabled?: boolean;
  publicVoteUnit?: "PROMPT" | "CATEGORY" | "ENTRY" | "ROUND";
  publicVoteMetric?: string;
  publicVoteDurationMinutes?: number;
  publicVoteStartsAt?: Date | null;
  publicVoteEndsAt?: Date | null;
  publicVoteProvider?: "NONE" | "INSTAGRAM_FUTURE";
  publicVoteStatus?: string;
  publicTieBreakMode?: string;
  timezone?: string | null;
};

export async function getPublicVoteConfig(contestId: string) {
  const config = await getOrCreateCompetitionJuryConfig(contestId);
  return {
    contestId,
    publicVoteMode: config.publicVoteMode,
    publicVoteEnabled: config.publicVoteEnabled,
    publicVoteUnit: config.publicVoteUnit,
    publicVoteMetric: config.publicVoteMetric,
    publicVoteDurationMinutes: config.publicVoteDurationMinutes,
    publicVoteStartsAt: config.publicVoteStartsAt,
    publicVoteEndsAt: config.publicVoteEndsAt,
    publicVoteProvider: config.publicVoteProvider,
    publicVoteStatus: config.publicVoteStatus,
    publicTieBreakMode: config.publicTieBreakMode,
    timezone: config.timezone,
    finalistsPerUnit: config.finalistsPerUnit,
  };
}

export async function upsertPublicVoteConfig(input: {
  contestId: string;
  actorUserId: number;
  config: PublicVoteConfigInput;
}) {
  const c = input.config;

  if (c.publicVoteMode != null && !ALLOWED_MODES.has(c.publicVoteMode)) {
    throw new JuryError("INVALID_INPUT", `publicVoteMode inválido: ${c.publicVoteMode}.`, 400);
  }
  if (c.publicVoteUnit != null && !ALLOWED_UNITS.has(c.publicVoteUnit)) {
    throw new JuryError("INVALID_INPUT", `publicVoteUnit inválido: ${c.publicVoteUnit}.`, 400);
  }
  if (c.publicVoteProvider != null && !ALLOWED_PROVIDERS.has(c.publicVoteProvider)) {
    throw new JuryError("INVALID_INPUT", `publicVoteProvider inválido: ${c.publicVoteProvider}.`, 400);
  }
  if (c.publicVoteStatus != null && !ALLOWED_STATUSES.has(c.publicVoteStatus)) {
    throw new JuryError("INVALID_INPUT", `publicVoteStatus inválido: ${c.publicVoteStatus}.`, 400);
  }
  if (c.publicVoteDurationMinutes != null && c.publicVoteDurationMinutes <= 0) {
    throw new JuryError("INVALID_INPUT", "publicVoteDurationMinutes debe ser > 0.", 400);
  }
  if (c.publicVoteStartsAt && c.publicVoteEndsAt && c.publicVoteEndsAt.getTime() <= c.publicVoteStartsAt.getTime()) {
    throw new JuryError("INVALID_INPUT", "publicVoteEndsAt debe ser posterior a publicVoteStartsAt.", 400);
  }

  // "Never enable commercial auto": cualquier intento de habilitación explícita pasa por el guard
  // de concursos comerciales excluidos de esta etapa.
  if (c.publicVoteEnabled === true || (c.publicVoteMode && c.publicVoteMode !== "DISABLED")) {
    assertJuryActivationAllowed(input.contestId);
  }
  // INSTAGRAM_FUTURE es solo modelado (§9.3 fuera de alcance) — nunca se activa automáticamente.
  if (c.publicVoteProvider === "INSTAGRAM_FUTURE" && c.publicVoteEnabled === true) {
    throw new JuryError(
      "INVALID_INPUT",
      "publicVoteProvider INSTAGRAM_FUTURE no está implementado; no puede habilitarse (publicVoteEnabled).",
      400,
    );
  }

  await getOrCreateCompetitionJuryConfig(input.contestId);

  const updated = await prisma.fotorankCompetitionJuryConfig.update({
    where: { contestId: input.contestId },
    data: {
      publicVoteMode: c.publicVoteMode ?? undefined,
      publicVoteEnabled: c.publicVoteEnabled ?? undefined,
      publicVoteUnit: c.publicVoteUnit ?? undefined,
      publicVoteMetric: c.publicVoteMetric ?? undefined,
      publicVoteDurationMinutes: c.publicVoteDurationMinutes ?? undefined,
      publicVoteStartsAt: c.publicVoteStartsAt === undefined ? undefined : c.publicVoteStartsAt,
      publicVoteEndsAt: c.publicVoteEndsAt === undefined ? undefined : c.publicVoteEndsAt,
      publicVoteProvider: c.publicVoteProvider ?? undefined,
      publicVoteStatus: c.publicVoteStatus ?? undefined,
      publicTieBreakMode: c.publicTieBreakMode ?? undefined,
      timezone: c.timezone === undefined ? undefined : c.timezone,
    },
  });

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (contest) {
    await prisma.fotorankJudgeAuditEvent.create({
      data: {
        organizationId: contest.organizationId,
        contestId: input.contestId,
        actorType: "ADMIN",
        actorUserId: input.actorUserId,
        eventType: "PUBLIC_VOTE_CONFIG_UPDATED",
        entityType: "FotorankCompetitionJuryConfig",
        entityId: updated.id,
        payloadJson: {
          publicVoteMode: updated.publicVoteMode,
          publicVoteEnabled: updated.publicVoteEnabled,
          publicVoteUnit: updated.publicVoteUnit,
          publicVoteMetric: updated.publicVoteMetric,
          publicVoteProvider: updated.publicVoteProvider,
          publicVoteStatus: updated.publicVoteStatus,
        } satisfies Prisma.JsonObject,
      },
    });
  }

  return updated;
}
