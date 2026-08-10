/**
 * ETAPA 16B — Checklist previo a preparar voto público (§9, §9.2, §10 master rules;
 * ver también `docs/clickaton/pre-public-vote-checklist.md`, documental).
 * Solo lectura. `confirmFinalistsForPublicVote` debe exigir READY_FOR_PUBLIC_VOTE.
 * NUNCA valida ni requiere integración de proveedor real (Instagram) — eso es §9.3, fuera de alcance.
 */
import { prisma } from "@repo/db";
import { getOrCreateCompetitionJuryConfig, isClickatonJuryContest } from "./competition-jury-config";
import { assertNoPiiInFinalistMetadata } from "./finalist-pii-guard";

const PUBLIC_CODE_PATTERN = /^C\d{2}-F\d{2}$/;
const ALLOWED_UNITS = new Set(["PROMPT", "CATEGORY", "ENTRY", "ROUND"]);
const ALLOWED_PROVIDERS = new Set(["NONE", "INSTAGRAM_FUTURE"]);

export type PrePublicVoteReasonCode =
  | "CONTEST_NOT_FOUND"
  | "JURY_SESSION_NOT_CLOSED"
  | "NO_FINALISTS_COMPUTED"
  | "FINALISTS_INCOMPLETE_FOR_PROMPT"
  | "UNEXPECTED_POSITIONS_COUNT"
  | "ASSETS_NOT_READY"
  | "INVALID_PUBLIC_CODE"
  | "PII_DETECTED"
  | "INVALID_PUBLIC_VOTE_CONFIG"
  | "INVALID_VOTE_WINDOW";

export type PrePublicVoteReadinessResult = {
  status: "READY_FOR_PUBLIC_VOTE" | "BLOCKED";
  reasons: Array<{ code: PrePublicVoteReasonCode; message: string }>;
  checks: Record<
    | "juryClosed"
    | "finalistsPerPromptComplete"
    | "positionsCount"
    | "noUnresolvedTies"
    | "assetsReady"
    | "codesValid"
    | "noPii"
    | "configValid"
    | "providerAcceptable"
    | "voteWindowValid",
    { pass: boolean; detail?: Record<string, unknown> }
  >;
  positionsCount: number;
  expectedPositionsCount: number;
};

export async function evaluatePrePublicVoteReadiness(contestId: string): Promise<PrePublicVoteReadinessResult> {
  const reasons: PrePublicVoteReadinessResult["reasons"] = [];

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, distributionChannel: true, experienceType: true },
  });
  if (!contest) {
    return {
      status: "BLOCKED",
      reasons: [{ code: "CONTEST_NOT_FOUND", message: "Concurso no encontrado." }],
      checks: {
        juryClosed: { pass: false },
        finalistsPerPromptComplete: { pass: false },
        positionsCount: { pass: false },
        noUnresolvedTies: { pass: false },
        assetsReady: { pass: false },
        codesValid: { pass: false },
        noPii: { pass: false },
        configValid: { pass: false },
        providerAcceptable: { pass: false },
        voteWindowValid: { pass: false },
      },
      positionsCount: 0,
      expectedPositionsCount: 0,
    };
  }

  const config = await getOrCreateCompetitionJuryConfig(contestId);
  const isClickaton = isClickatonJuryContest(contest);

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId, status: { in: ["CLOSED", "LOCKED"] } },
    orderBy: { closedAt: "desc" },
  });
  const juryClosedCheck = { pass: Boolean(session), detail: { sessionId: session?.id ?? null } };
  if (!juryClosedCheck.pass) {
    reasons.push({ code: "JURY_SESSION_NOT_CLOSED", message: "No hay sesión de jurado CLOSED/LOCKED." });
  }

  const activeSnapshots = session
    ? await prisma.fotorankFinalistSnapshot.findMany({
        where: { contestId, scoringSessionId: session.id, status: { in: ["DRAFT", "CONFIRMED"] } },
      })
    : [];

  const allSnapshotIdsForPrompts = session
    ? await prisma.fotorankJuryEntrySnapshot.findMany({
        where: { admissionBatchId: session.admissionBatchId, promptExternalId: { not: null } },
        select: { promptExternalId: true },
        distinct: ["promptExternalId"],
      })
    : [];
  const totalPromptsWithCandidates = new Set(
    allSnapshotIdsForPrompts.map((s) => s.promptExternalId).filter(Boolean) as string[],
  ).size;

  const finalistsByPrompt = new Map<string, number>();
  for (const s of activeSnapshots) {
    finalistsByPrompt.set(s.promptExternalId, (finalistsByPrompt.get(s.promptExternalId) ?? 0) + 1);
  }
  const incompletePrompts = [...finalistsByPrompt.entries()].filter(
    ([, count]) => count !== config.finalistsPerUnit,
  );
  const missingPrompts = totalPromptsWithCandidates - finalistsByPrompt.size;

  const finalistsPerPromptCompleteCheck = {
    pass: activeSnapshots.length > 0 && incompletePrompts.length === 0 && missingPrompts <= 0,
    detail: {
      promptCount: finalistsByPrompt.size,
      totalPromptsWithCandidates,
      incompletePrompts: incompletePrompts.map(([id, count]) => ({ promptExternalId: id, count })),
      missingPrompts,
    },
  };
  if (activeSnapshots.length === 0) {
    reasons.push({ code: "NO_FINALISTS_COMPUTED", message: "No hay finalistas calculados para esta sesión." });
  } else if (incompletePrompts.length > 0 || missingPrompts > 0) {
    reasons.push({
      code: "FINALISTS_INCOMPLETE_FOR_PROMPT",
      message: `Hay ${incompletePrompts.length + Math.max(0, missingPrompts)} consigna(s) sin ${config.finalistsPerUnit} finalistas confirmados (posible desempate pendiente).`,
    });
  }

  const positionsCount = activeSnapshots.length;
  const expectedPositionsCount = totalPromptsWithCandidates * config.finalistsPerUnit;
  const positionsCountCheck = {
    pass: !isClickaton || positionsCount === 30,
    detail: { positionsCount, expectedPositionsCount, isClickaton },
  };
  if (isClickaton && positionsCount !== 30) {
    reasons.push({
      code: "UNEXPECTED_POSITIONS_COUNT",
      message: `Clickatón espera 30 posiciones (10 consignas × 3); hay ${positionsCount}.`,
    });
  }

  const noUnresolvedTiesCheck = { pass: incompletePrompts.length === 0 && missingPrompts <= 0 };

  const assetsReadyCheck = {
    pass: activeSnapshots.every((s) => s.derivativeStatus === "READY"),
    detail: { notReadyCount: activeSnapshots.filter((s) => s.derivativeStatus !== "READY").length },
  };
  if (!assetsReadyCheck.pass) {
    reasons.push({
      code: "ASSETS_NOT_READY",
      message: "Hay derivados sociales pendientes (derivativeStatus != READY). Ejecutá public-asset-prep.",
    });
  }

  const codesValidCheck = {
    pass: activeSnapshots.every((s) => PUBLIC_CODE_PATTERN.test(s.publicCode)),
    detail: { invalidCount: activeSnapshots.filter((s) => !PUBLIC_CODE_PATTERN.test(s.publicCode)).length },
  };
  if (!codesValidCheck.pass) {
    reasons.push({ code: "INVALID_PUBLIC_CODE", message: "Hay publicCode con formato inválido (esperado CNN-FN)." });
  }

  let piiOk = true;
  for (const s of activeSnapshots) {
    try {
      assertNoPiiInFinalistMetadata(s.metadataJson);
    } catch {
      piiOk = false;
      break;
    }
  }
  const noPiiCheck = { pass: piiOk };
  if (!piiOk) reasons.push({ code: "PII_DETECTED", message: "Se detectó un campo potencialmente identificatorio en metadataJson." });

  const configValidCheck = {
    pass:
      config.publicVoteDurationMinutes > 0 &&
      ALLOWED_UNITS.has(config.publicVoteUnit) &&
      config.publicVoteMetric.trim().length > 0,
    detail: {
      publicVoteDurationMinutes: config.publicVoteDurationMinutes,
      publicVoteUnit: config.publicVoteUnit,
      publicVoteMetric: config.publicVoteMetric,
    },
  };
  if (!configValidCheck.pass) {
    reasons.push({ code: "INVALID_PUBLIC_VOTE_CONFIG", message: "Configuración de voto público inválida (unidad/métrica/duración)." });
  }

  // Provider NOT required yet: NONE es válido y esperado en esta etapa (§9.3 fuera de alcance).
  const providerAcceptableCheck = { pass: ALLOWED_PROVIDERS.has(config.publicVoteProvider) };
  if (!providerAcceptableCheck.pass) {
    reasons.push({ code: "INVALID_PUBLIC_VOTE_CONFIG", message: `publicVoteProvider desconocido: ${config.publicVoteProvider}.` });
  }

  const voteWindowValidCheck = {
    pass:
      !config.publicVoteStartsAt ||
      !config.publicVoteEndsAt ||
      config.publicVoteEndsAt.getTime() > config.publicVoteStartsAt.getTime(),
  };
  if (!voteWindowValidCheck.pass) {
    reasons.push({ code: "INVALID_VOTE_WINDOW", message: "publicVoteEndsAt debe ser posterior a publicVoteStartsAt." });
  }

  return {
    status: reasons.length === 0 ? "READY_FOR_PUBLIC_VOTE" : "BLOCKED",
    reasons,
    checks: {
      juryClosed: juryClosedCheck,
      finalistsPerPromptComplete: finalistsPerPromptCompleteCheck,
      positionsCount: positionsCountCheck,
      noUnresolvedTies: noUnresolvedTiesCheck,
      assetsReady: assetsReadyCheck,
      codesValid: codesValidCheck,
      noPii: noPiiCheck,
      configValid: configValidCheck,
      providerAcceptable: providerAcceptableCheck,
      voteWindowValid: voteWindowValidCheck,
    },
    positionsCount,
    expectedPositionsCount,
  };
}
