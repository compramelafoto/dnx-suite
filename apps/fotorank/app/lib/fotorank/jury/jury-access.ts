import { prisma } from "@repo/db";
import { JuryError } from "./errors";

const ACTIVE_ASSIGNMENT = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED", "ASSIGNED"] as const;

export async function assertJudgeContestAccess(input: {
  judgeAccountId: string;
  contestId: string;
  categoryId?: string;
}) {
  const judge = await prisma.fotorankJudgeAccount.findUnique({
    where: { id: input.judgeAccountId },
    select: { id: true, accountStatus: true },
  });
  if (!judge || judge.accountStatus !== "ACTIVE") {
    throw new JuryError("FORBIDDEN", "Cuenta de jurado no activa.", 403);
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: {
      id: true,
      status: true,
      title: true,
      slug: true,
      judgingEndAt: true,
      judgingStartAt: true,
    },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  if (contest.status === "ARCHIVED" || contest.status === "DRAFT") {
    throw new JuryError("FORBIDDEN", "El concurso no está habilitado para el jurado.", 403);
  }

  const assignments = await prisma.fotorankJudgeAssignment.findMany({
    where: {
      contestId: input.contestId,
      judgeAccountId: input.judgeAccountId,
      assignmentStatus: { in: [...ACTIVE_ASSIGNMENT] },
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  if (assignments.length === 0) {
    throw new JuryError("NOT_ASSIGNED", "No tenés asignación en este concurso.", 403);
  }

  if (input.categoryId) {
    const hit = assignments.find((a) => a.categoryId === input.categoryId);
    if (!hit) {
      throw new JuryError("CATEGORY_NOT_ASSIGNED", "No estás asignado a esta categoría.", 403);
    }
  }

  return { contest, assignments, categoryIds: assignments.map((a) => a.categoryId) };
}

export async function assertJuryEntryAccess(input: {
  judgeAccountId: string;
  contestId: string;
  entryId: string;
}) {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      assets: {
        where: { isActive: true, kind: { in: ["JURY_PREVIEW", "THUMBNAIL", "ORIGINAL"] } },
      },
      checks: true,
      activeAsset: { include: { exifMetadata: true } },
      judgeConflicts: {
        where: { judgeAccountId: input.judgeAccountId, status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!entry) throw new JuryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  if (!access.categoryIds.includes(entry.categoryId)) {
    throw new JuryError("CATEGORY_NOT_ASSIGNED", "No estás asignado a la categoría de esta obra.", 403);
  }
  if (entry.status !== "CONFIRMED" || entry.withdrawnAt) {
    throw new JuryError("ENTRY_NOT_CONFIRMABLE", "La obra no está disponible para evaluación.", 403);
  }
  if (!entry.entryNumber && !entry.anonymousJuryCode) {
    throw new JuryError("ENTRY_NOT_CONFIRMABLE", "La obra no tiene código anónimo.", 403);
  }

  // Etapa 14: Clickatón / admisión aplicada → solo FROZEN_FOR_JURY.
  const admissionApplied = entry.admissionStatus != null;
  if (
    (entry.sourcePlatform === "CLICKATON" || admissionApplied) &&
    entry.admissionStatus !== "FROZEN_FOR_JURY"
  ) {
    throw new JuryError(
      "ENTRY_NOT_FROZEN",
      "La obra no está congelada para jurado.",
      403,
    );
  }

  const snapshot = await prisma.fotorankJuryEntrySnapshot.findFirst({
    where: {
      entryId: entry.id,
      contestId: input.contestId,
      batch: { status: "FROZEN" },
    },
    orderBy: { frozenAt: "desc" },
  });
  if ((entry.sourcePlatform === "CLICKATON" || admissionApplied) && !snapshot) {
    throw new JuryError("SNAPSHOT_MISSING", "No hay snapshot congelado para esta obra.", 404);
  }

  const juryPreview =
    entry.assets.find((a) => a.kind === "JURY_PREVIEW") ??
    entry.assets.find((a) => a.kind === "THUMBNAIL") ??
    (snapshot?.juryAssetId
      ? await prisma.fotorankContestEntryAsset.findUnique({ where: { id: snapshot.juryAssetId } })
      : null);
  if (!juryPreview) {
    throw new JuryError("PREVIEW_MISSING", "No hay preview de jurado disponible.", 404);
  }

  return { ...access, entry, juryPreview, snapshot };
}
