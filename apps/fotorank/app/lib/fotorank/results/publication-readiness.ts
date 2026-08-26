import { prisma } from "@repo/db";
import { buildResultPublicationHash } from "./publication-hash";
import {
  parsePublicationMeta,
  type PublicationReadiness,
  type PublicationReasonCode,
  type ResultPublicationMeta,
} from "./publication-types";

function isConfirmed(status: string | undefined): boolean {
  return status === "CONFIRMED" || status === "STAGING_TEST_CONFIGURATION";
}

export async function evaluateResultPublicationReadiness(input: {
  contestId: string;
  batchId?: string | null;
}): Promise<PublicationReadiness> {
  const reasonCodes: PublicationReasonCode[] = [];
  const warnings: string[] = [];
  const missingApprovals: string[] = [];

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, slug: true, status: true, categories: { where: { status: "ACTIVE" }, select: { id: true, slug: true } } },
  });
  if (!contest) {
    return {
      status: "BLOCKED",
      reasonCodes: ["CONTEST_NOT_READY"],
      warnings: [],
      missingApprovals: [],
      publishableCategorySlugs: [],
      nonPublishableCategorySlugs: [],
      batchId: null,
      sessionId: null,
      publicationHash: null,
      meta: null,
    };
  }

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: { in: ["CLOSED", "LOCKED"] } },
    orderBy: { closedAt: "desc" },
    include: { rubric: { select: { id: true, status: true, description: true, name: true } } },
  });
  if (!session) reasonCodes.push("JURY_SESSION_NOT_CLOSED");

  const batch = await prisma.fotorankResultBatch.findFirst({
    where: {
      contestId: input.contestId,
      ...(input.batchId ? { id: input.batchId } : {}),
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      entries: true,
      ruleSet: { select: { version: true, status: true, configJson: true } },
    },
  });
  if (!batch) {
    reasonCodes.push("RESULT_BATCH_MISSING");
  } else {
    if (batch.status === "PUBLISHED" && parsePublicationMeta(batch.metadata).publication?.status === "LIVE") {
      reasonCodes.push("PUBLICATION_ALREADY_LIVE");
    }
    if (batch.status !== "FINALIZED" && batch.status !== "PUBLISHED") {
      reasonCodes.push("RESULT_BATCH_NOT_FINALIZED");
    }
    if (session && batch.scoringSessionId !== session.id) {
      reasonCodes.push("RESULT_BATCH_STALE");
      warnings.push("El batch no corresponde a la última sesión CLOSED.");
    }
    const incomplete = batch.entries.filter((e) => e.coverageStatus === "INCOMPLETE").length;
    const ties = batch.entries.filter((e) => e.resultStatus === "TIED").length;
    if (incomplete > 0) reasonCodes.push("INCOMPLETE_COVERAGE");
    if (ties > 0) reasonCodes.push("UNRESOLVED_TIE");
  }

  const meta: ResultPublicationMeta | null = batch ? parsePublicationMeta(batch.metadata) : null;

  if (meta) {
    if (!isConfirmed(meta.rubricConfirmation?.status)) {
      reasonCodes.push("RUBRIC_NOT_CONFIRMED");
      missingApprovals.push("rubric");
    } else if (meta.rubricConfirmation?.status === "STAGING_TEST_CONFIGURATION") {
      warnings.push("Rúbrica marcada como STAGING_TEST_CONFIGURATION — no oficial.");
    }
    if (!isConfirmed(meta.awardsConfig?.status)) {
      reasonCodes.push("AWARDS_NOT_CONFIRMED");
      missingApprovals.push("awards");
    }
    if (!isConfirmed(meta.finalistsConfig?.status)) {
      reasonCodes.push("FINALISTS_NOT_CONFIGURED");
      missingApprovals.push("finalists");
    }
    if (!meta.winnerSelections?.length && !(batch?.entries.some((e) => e.awardType === "FIRST_PLACE"))) {
      reasonCodes.push("WINNERS_NOT_CONFIGURED");
      missingApprovals.push("winners");
    }
    if (meta.institutionalReview?.status !== "APPROVED") {
      reasonCodes.push("INSTITUTIONAL_APPROVAL_MISSING");
      missingApprovals.push("institutional");
    }
    if (meta.legalReview?.status !== "APPROVED") {
      reasonCodes.push("LEGAL_APPROVAL_MISSING");
      missingApprovals.push("legal");
    }
    if (meta.publication?.status === "REVOKED") {
      reasonCodes.push("RESULT_REVOKED");
    }
    const pubDate = meta.publication?.scheduledAt ?? meta.publication?.publishedAt;
    if (!pubDate && meta.publication?.status !== "LIVE") {
      // fecha requerida para READY (puede ser "ahora" al publicar manual)
      // no bloquea si se provee en el apply; aquí warning
      warnings.push("Fecha de publicación pendiente de confirmar en el apply.");
    }
  } else {
    reasonCodes.push("RUBRIC_NOT_CONFIRMED");
    reasonCodes.push("AWARDS_NOT_CONFIRMED");
    reasonCodes.push("INSTITUTIONAL_APPROVAL_MISSING");
    reasonCodes.push("LEGAL_APPROVAL_MISSING");
  }

  // Santa Fe: rúbrica jury description aún PENDING → warning + block si no confirmada en meta
  if (
    contest.slug === "santa-fe-en-foco" &&
    session?.rubric.description?.includes("PENDING_ORGANIZER_DECISION") &&
    !isConfirmed(meta?.rubricConfirmation?.status)
  ) {
    if (!reasonCodes.includes("RUBRIC_NOT_CONFIRMED")) reasonCodes.push("RUBRIC_NOT_CONFIRMED");
  }

  const categorySlugs = contest.categories.map((c) => c.slug);
  const publishable =
    reasonCodes.length === 0 ? categorySlugs : [];
  const nonPublishable =
    reasonCodes.length === 0 ? [] : categorySlugs;

  let publicationHash: string | null = null;
  if (batch && meta) {
    publicationHash = buildResultPublicationHash({
      contestId: input.contestId,
      batchId: batch.id,
      engineVersion: batch.engineVersion,
      ruleSetVersion: batch.ruleSetVersion,
      entries: batch.entries.map((e) => ({
        anonymousCode: e.anonymousCode,
        categoryId: e.categoryId,
        scopeKey: e.scopeKey,
        finalPosition: e.finalPosition,
        aggregateScore: e.aggregateScore,
        awardType: e.awardType,
        resultStatus: e.resultStatus,
      })),
      finalists: (meta.finalistSelections ?? []).map((f) => ({
        anonymousCode: f.anonymousCode,
        categoryId: f.categoryId,
        status: f.status,
      })),
      winners: (meta.winnerSelections ?? []).map((w) => ({
        anonymousCode: w.anonymousCode,
        categoryId: w.categoryId,
        awardType: w.awardType,
      })),
      awardsConfigStatus: meta.awardsConfig?.status ?? "PENDING_ORGANIZER_DECISION",
      rubricStatus: meta.rubricConfirmation?.status ?? "PENDING_ORGANIZER_DECISION",
      institutionalStatus: meta.institutionalReview?.status ?? "PENDING",
      legalStatus: meta.legalReview?.status ?? "NOT_REQUESTED",
      publicScoresMode: meta.publication?.publicScoresMode ?? "HIDDEN",
    });
  }

  return {
    status: reasonCodes.length === 0 ? "READY" : "BLOCKED",
    reasonCodes: [...new Set(reasonCodes)],
    warnings,
    missingApprovals: [...new Set(missingApprovals)],
    publishableCategorySlugs: publishable,
    nonPublishableCategorySlugs: nonPublishable,
    batchId: batch?.id ?? null,
    sessionId: session?.id ?? null,
    publicationHash,
    meta,
  };
}
