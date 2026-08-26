import { prisma } from "@repo/db";
import { getContestEntryStorage } from "../storage/provider";
import { assertJudgeContestAccess, assertJuryEntryAccess } from "./jury-access";
import { sortEntriesForJuror } from "./jury-order";
import { buildJuryTechnicalSummary } from "./jury-technical-summary";
import {
  assertNoForbiddenJuryFields,
  type JuryEntryDetail,
  type JuryEntryListItem,
} from "./serialize-entry-for-juror";
import { JuryError } from "./errors";

const PREVIEW_TTL_SEC = 600;

export async function listAnonymousEntriesForJuror(input: {
  judgeAccountId: string;
  contestId: string;
}): Promise<{ contestTitle: string; judgingEndsAt: string | null; entries: JuryEntryListItem[] }> {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  const conflicts = await prisma.fotorankJudgeEntryConflict.findMany({
    where: {
      contestId: input.contestId,
      judgeAccountId: input.judgeAccountId,
      status: "ACTIVE",
    },
    select: { entryId: true },
  });
  const conflictSet = new Set(conflicts.map((c) => c.entryId));

  // Preferir roster congelado (Etapa 13/14). Fallback nativo FR sin admisión.
  const frozenBatch = await prisma.fotorankAdmissionBatch.findFirst({
    where: { contestId: input.contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
  });

  const storage = getContestEntryStorage();
  const mapped: JuryEntryListItem[] = [];

  if (frozenBatch) {
    const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
      where: {
        admissionBatchId: frozenBatch.id,
        categoryId: { in: access.categoryIds },
      },
      include: {
        entry: {
          select: {
            id: true,
            technicalSummaryStatus: true,
            checks: { select: { status: true } },
            assets: {
              where: { isActive: true, kind: { in: ["JURY_PREVIEW", "THUMBNAIL"] } },
            },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    const promptIds = [
      ...new Set(snapshots.map((s) => s.promptExternalId).filter(Boolean) as string[]),
    ];
    const prompts = promptIds.length
      ? await prisma.clickatonPrompt.findMany({
          where: { id: { in: promptIds }, status: { in: ["RELEASED", "CLOSED"] } },
          select: { id: true, sequence: true, title: true },
        })
      : [];
    const promptById = new Map(prompts.map((p) => [p.id, p]));

    const evals = await prisma.fotorankJuryEvaluation.findMany({
      where: {
        jurorId: input.judgeAccountId,
        admissionBatchId: frozenBatch.id,
        juryEntrySnapshotId: { in: snapshots.map((s) => s.id) },
      },
      select: { juryEntrySnapshotId: true, status: true },
    });
    const evalBySnap = new Map(evals.map((e) => [e.juryEntrySnapshotId, e.status]));

    for (const snap of snapshots) {
      if (conflictSet.has(snap.entryId)) continue;
      const previewAsset =
        snap.entry.assets.find((a) => a.kind === "JURY_PREVIEW") ??
        snap.entry.assets.find((a) => a.kind === "THUMBNAIL") ??
        (snap.juryAssetId
          ? await prisma.fotorankContestEntryAsset.findUnique({ where: { id: snap.juryAssetId } })
          : null);
      if (!previewAsset) continue;
      const prompt = snap.promptExternalId ? promptById.get(snap.promptExternalId) : null;
      const st = evalBySnap.get(snap.id);
      const evaluationStatus =
        st === "SUBMITTED" || st === "LOCKED"
          ? "COMPLETED"
          : st === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      const warningCount = snap.entry.checks.filter(
        (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
      ).length;
      const previewUrl = await storage.getSignedUrl(previewAsset.storageKey, "read", PREVIEW_TTL_SEC);
      mapped.push({
        entryId: snap.entryId,
        snapshotId: snap.id,
        anonymousCode: snap.anonymousCode,
        categoryId: snap.entry.category.id,
        categoryName: snap.entry.category.name,
        promptSequence: prompt?.sequence ?? null,
        promptTitle: prompt?.title ?? null,
        technicalSummaryStatus: snap.entry.technicalSummaryStatus,
        warningCount,
        evaluationStatus,
        conflictDeclared: false,
        previewUrl,
        sortKey: "",
      });
    }
  } else {
    const rows = await prisma.fotorankContestEntry.findMany({
      where: {
        contestId: input.contestId,
        categoryId: { in: access.categoryIds },
        status: "CONFIRMED",
        withdrawnAt: null,
        entryNumber: { not: null },
        OR: [{ admissionStatus: null }, { admissionStatus: "FROZEN_FOR_JURY" }],
      },
      include: {
        category: { select: { id: true, name: true } },
        checks: { select: { status: true } },
        assets: {
          where: { isActive: true, kind: { in: ["JURY_PREVIEW", "THUMBNAIL"] } },
        },
      },
    });
    for (const row of rows) {
      if (conflictSet.has(row.id)) continue;
      if (row.sourcePlatform === "CLICKATON") continue; // sin batch FROZEN no listar Clickatón
      const preview =
        row.assets.find((a) => a.kind === "JURY_PREVIEW") ??
        row.assets.find((a) => a.kind === "THUMBNAIL");
      if (!preview) continue;
      const warningCount = row.checks.filter(
        (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
      ).length;
      const previewUrl = await storage.getSignedUrl(preview.storageKey, "read", PREVIEW_TTL_SEC);
      mapped.push({
        entryId: row.id,
        snapshotId: null,
        anonymousCode: row.entryNumber!,
        categoryId: row.category.id,
        categoryName: row.category.name,
        promptSequence: null,
        promptTitle: null,
        technicalSummaryStatus: row.technicalSummaryStatus,
        warningCount,
        evaluationStatus: "NOT_STARTED",
        conflictDeclared: false,
        previewUrl,
        sortKey: "",
      });
    }
  }

  const ordered = sortEntriesForJuror(mapped, input.judgeAccountId, input.contestId);
  const payload = {
    contestTitle: access.contest.title,
    judgingEndsAt: access.contest.judgingEndAt?.toISOString() ?? null,
    entries: ordered,
  };
  const leaks = assertNoForbiddenJuryFields(payload);
  if (leaks.length) {
    throw new JuryError("FORBIDDEN", `Respuesta jurado filtró campos prohibidos: ${leaks.join(",")}`, 500);
  }
  return payload;
}

export async function getAnonymousEntryDetailForJuror(input: {
  judgeAccountId: string;
  contestId: string;
  entryId: string;
}): Promise<JuryEntryDetail> {
  const { contest, entry, juryPreview, snapshot } = await assertJuryEntryAccess(input);
  const conflict = entry.judgeConflicts[0];
  if (conflict) {
    throw new JuryError("FORBIDDEN", "Declaraste conflicto sobre esta obra.", 403);
  }

  const storage = getContestEntryStorage();
  let previewUrl: string | null = null;
  try {
    previewUrl = await storage.getSignedUrl(juryPreview.storageKey, "read", PREVIEW_TTL_SEC);
  } catch {
    previewUrl = null;
  }
  const warningCount = entry.checks.filter(
    (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
  ).length;

  const prompt =
    snapshot?.promptExternalId || entry.externalPromptId
      ? await prisma.clickatonPrompt.findFirst({
          where: {
            id: snapshot?.promptExternalId ?? entry.externalPromptId!,
            status: { in: ["RELEASED", "CLOSED"] },
          },
          select: { sequence: true, title: true, instructions: true },
        })
      : null;

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN", scoringEnabled: true },
    include: {
      rubric: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
    },
    orderBy: { openedAt: "desc" },
  });

  const evaluation = snapshot
    ? await prisma.fotorankJuryEvaluation.findFirst({
        where: {
          jurorId: input.judgeAccountId,
          juryEntrySnapshotId: snapshot.id,
        },
        include: { criterionScores: true },
      })
    : null;

  const evaluationStatus =
    evaluation?.status === "SUBMITTED" || evaluation?.status === "LOCKED"
      ? "COMPLETED"
      : evaluation?.status === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : "NOT_STARTED";

  const technical = buildJuryTechnicalSummary({
    technicalSummaryStatus: entry.technicalSummaryStatus,
    width: juryPreview.width ?? entry.activeAsset?.width ?? null,
    height: juryPreview.height ?? entry.activeAsset?.height ?? null,
    checks: entry.checks,
    metadata: entry.activeAsset?.exifMetadata
      ? {
          metadataStatus: entry.activeAsset.exifMetadata.metadataStatus,
          orientation: entry.activeAsset.exifMetadata.orientation,
          software: entry.activeAsset.exifMetadata.software,
        }
      : null,
    manualReviewStatus: entry.manualReviewStatus,
    evaluationStatus,
  });

  const scores: Record<string, number> = {};
  for (const s of evaluation?.criterionScores ?? []) {
    scores[s.criterionKeySnapshot] = s.score;
  }

  const detail: JuryEntryDetail = {
    entryId: entry.id,
    snapshotId: snapshot?.id ?? null,
    anonymousCode: snapshot?.anonymousCode ?? entry.anonymousJuryCode ?? entry.entryNumber!,
    categoryId: entry.category.id,
    categoryName: entry.category.name,
    promptSequence: prompt?.sequence ?? null,
    promptTitle: prompt?.title ?? null,
    promptInstructions: prompt?.instructions ?? null,
    technicalSummaryStatus: entry.technicalSummaryStatus,
    warningCount,
    evaluationStatus,
    conflictDeclared: false,
    previewUrl,
    sortKey: "",
    technical,
    judgingEndsAt: contest.judgingEndAt?.toISOString() ?? null,
    rubric: session
      ? {
          id: session.rubric.id,
          name: session.rubric.name,
          version: session.rubric.version,
          criteria: session.rubric.criteria.map((c) => ({
            key: c.key,
            name: c.name,
            description: c.description,
            minScore: c.minScore,
            maxScore: c.maxScore,
            step: c.step,
            weight: c.weight,
            required: c.required,
            helpText: c.helpText,
          })),
        }
      : null,
    evaluation: evaluation
      ? {
          id: evaluation.id,
          status: evaluation.status,
          expectedVersion: evaluation.expectedVersion,
          totalScore: evaluation.totalScore,
          privateComment: evaluation.privateComment,
          scores,
        }
      : null,
    scoringSessionOpen: Boolean(session),
  };

  const leaks = assertNoForbiddenJuryFields(detail);
  if (leaks.length) {
    throw new JuryError("FORBIDDEN", `Detalle jurado con campos prohibidos: ${leaks.join(",")}`, 500);
  }
  return detail;
}

export async function getJuryPreviewAccess(input: {
  judgeAccountId: string;
  contestId: string;
  entryId: string;
}): Promise<{ previewUrl: string; expiresInSeconds: number; kind: "JURY_PREVIEW"; anonymousCode: string }> {
  const { entry, juryPreview } = await assertJuryEntryAccess(input);
  if (entry.judgeConflicts[0]) {
    throw new JuryError("FORBIDDEN", "Declaraste conflicto sobre esta obra.", 403);
  }
  if (juryPreview.kind !== "JURY_PREVIEW") {
    throw new JuryError("ORIGINAL_FORBIDDEN", "Solo se permite JURY_PREVIEW.", 403);
  }

  const storage = getContestEntryStorage();
  const previewUrl = await storage.getSignedUrl(juryPreview.storageKey, "read", PREVIEW_TTL_SEC);

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: (
        await prisma.fotorankContest.findUniqueOrThrow({
          where: { id: input.contestId },
          select: { organizationId: true },
        })
      ).organizationId,
      contestId: input.contestId,
      actorType: "JUDGE",
      actorJudgeId: input.judgeAccountId,
      eventType: "JURY_PREVIEW_ACCESS",
      entityType: "FotorankContestEntry",
      entityId: entry.id,
      payloadJson: { anonymousCode: entry.entryNumber, assetKind: "JURY_PREVIEW" },
    },
  }).catch(() => {
    // auditoría best-effort
  });

  return {
    previewUrl,
    expiresInSeconds: PREVIEW_TTL_SEC,
    kind: "JURY_PREVIEW",
    anonymousCode: entry.entryNumber!,
  };
}

export async function declareJuryConflict(input: {
  judgeAccountId: string;
  contestId: string;
  entryId: string;
  reasonCode:
    | "KNOW_AUTHOR"
    | "PROFESSIONAL_RELATION"
    | "FAMILY_RELATION"
    | "PARTICIPATED_IN_PRODUCTION"
    | "OTHER";
  notes?: string;
}) {
  await assertJuryEntryAccess(input);

  const existing = await prisma.fotorankJudgeEntryConflict.findUnique({
    where: {
      entryId_judgeAccountId: {
        entryId: input.entryId,
        judgeAccountId: input.judgeAccountId,
      },
    },
  });
  if (existing?.status === "ACTIVE") {
    throw new JuryError("CONFLICT_EXISTS", "Ya declaraste conflicto sobre esta obra.", 409);
  }

  const row = await prisma.fotorankJudgeEntryConflict.upsert({
    where: {
      entryId_judgeAccountId: {
        entryId: input.entryId,
        judgeAccountId: input.judgeAccountId,
      },
    },
    create: {
      contestId: input.contestId,
      entryId: input.entryId,
      judgeAccountId: input.judgeAccountId,
      reasonCode: input.reasonCode,
      notes: input.notes?.trim() || null,
      status: "ACTIVE",
    },
    update: {
      reasonCode: input.reasonCode,
      notes: input.notes?.trim() || null,
      status: "ACTIVE",
      declaredAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });

  return {
    id: row.id,
    evaluationStatus: "CONFLICT_DECLARED" as const,
    message: "Conflicto registrado. Esta obra ya no se te asigna.",
  };
}
