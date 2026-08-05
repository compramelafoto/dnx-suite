/**
 * Dominio de `FotorankContestEntry` evaluable por jurados (P0-07).
 *
 * Obras nativas P0-06: status CONFIRMED + entryNumber + no retirada.
 * Legacy admin: imageUrl no vacío (compat).
 */

import { prisma } from "@repo/db";

export type FotorankContestEntryRow = {
  id: string;
  contestId: string;
  categoryId: string;
  imageUrl: string;
  status?: string | null;
  entryNumber?: string | null;
  withdrawnAt?: Date | null;
  title?: string | null;
  description?: string | null;
  authorUserId?: number | null;
  sourcePlatform?: string | null;
  admissionStatus?: string | null;
};

export type CategoryJudgingReadinessIssueCode =
  | "NO_ENTRIES"
  | "NO_EVALUABLE_ENTRIES";

export type CategoryJudgingReadiness = {
  contestId: string;
  categoryId: string;
  totalEntries: number;
  evaluableEntryCount: number;
  readyForJudgingPanel: boolean;
  issues: Array<{ code: CategoryJudgingReadinessIssueCode; message: string }>;
};

/**
 * Evaluable para panel jurado:
 * - Clickatón / con admisión: solo FROZEN_FOR_JURY (+ código anónimo)
 * - nativo FR sin admissionStatus: CONFIRMED + código anónimo + no retirada
 * - legacy: imageUrl no vacío
 */
export function isEvaluableFotorankContestEntry(
  row: Pick<
    FotorankContestEntryRow,
    | "imageUrl"
    | "contestId"
    | "categoryId"
    | "status"
    | "entryNumber"
    | "withdrawnAt"
    | "sourcePlatform"
    | "admissionStatus"
  >,
): boolean {
  if (!row.contestId?.trim() || !row.categoryId?.trim()) return false;
  if (row.withdrawnAt) return false;

  const fromClickaton = row.sourcePlatform === "CLICKATON";
  const admissionApplied = row.admissionStatus != null && row.admissionStatus !== "";
  if (fromClickaton || admissionApplied) {
    return row.admissionStatus === "FROZEN_FOR_JURY";
  }

  if (row.status === "CONFIRMED" && Boolean(row.entryNumber?.trim())) return true;
  const url = row.imageUrl?.trim() ?? "";
  return Boolean(url);
}

export function filterFotorankEntriesEvaluableForJudging<T extends FotorankContestEntryRow>(rows: T[]): T[] {
  return rows.filter((r) => isEvaluableFotorankContestEntry(r));
}

export async function getCategoryJudgingReadiness(
  contestId: string,
  categoryId: string,
): Promise<CategoryJudgingReadiness> {
  const rows = await prisma.fotorankContestEntry.findMany({
    where: { contestId, categoryId },
    select: {
      id: true,
      contestId: true,
      categoryId: true,
      imageUrl: true,
      status: true,
      entryNumber: true,
      withdrawnAt: true,
      admissionStatus: true,
      sourcePlatform: true,
    },
  });
  const totalEntries = rows.length;
  const evaluable = filterFotorankEntriesEvaluableForJudging(rows);
  const evaluableEntryCount = evaluable.length;
  const issues: CategoryJudgingReadiness["issues"] = [];
  if (totalEntries === 0) {
    issues.push({
      code: "NO_ENTRIES",
      message: "No hay obras cargadas en esta categoría para el concurso FotoRank.",
    });
  } else if (evaluableEntryCount === 0) {
    issues.push({
      code: "NO_EVALUABLE_ENTRIES",
      message: "Hay registros de obra pero ninguno está confirmado con preview de jurado.",
    });
  }
  return {
    contestId,
    categoryId,
    totalEntries,
    evaluableEntryCount,
    readyForJudgingPanel: evaluableEntryCount > 0,
    issues,
  };
}

export async function getContestJudgingReadinessSummary(contestId: string): Promise<{
  contestId: string;
  categories: CategoryJudgingReadiness[];
  anyCategoryReady: boolean;
}> {
  const categories = await prisma.fotorankContestCategory.findMany({
    where: { contestId },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  const list: CategoryJudgingReadiness[] = [];
  for (const c of categories) {
    list.push(await getCategoryJudgingReadiness(contestId, c.id));
  }
  return { contestId, categories: list, anyCategoryReady: list.some((x) => x.readyForJudgingPanel) };
}
