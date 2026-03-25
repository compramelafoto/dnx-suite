import { prisma } from "@repo/db";
import {
  extractScalarContribution,
  formatAggregateDisplay,
  humanizeAggregateLabel,
  rankEntriesForCategory,
  sortExplanation,
  type FotorankJudgeMethodType,
  type RankedEntryResult,
} from "./judgeResultsAggregation";

export type CategoryJudgeResults =
  | {
      ok: true;
      variant: "READY";
      methodType: FotorankJudgeMethodType;
      aggregationLabel: string;
      sortHelp: string;
      assignmentCount: number;
      ranked: RankedEntryResult[];
    }
  | {
      ok: true;
      variant: "NO_ASSIGNMENTS";
      message: string;
      ranked: RankedEntryResult[];
    }
  | {
      ok: false;
      code: "AMBIGUOUS_METHOD";
      methodTypesFound: FotorankJudgeMethodType[];
      message: string;
    }
  | { ok: false; code: "CATEGORY_NOT_FOUND" }
  | { ok: false; code: "CONTEST_NOT_FOUND" };

/**
 * Carga entradas + votos del dominio FotoRank y devuelve ranking o estado explícito.
 */
export async function getFotorankCategoryJudgeResults(params: {
  contestId: string;
  categoryId: string;
}): Promise<CategoryJudgeResults> {
  const { contestId, categoryId } = params;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true },
  });
  if (!contest) return { ok: false, code: "CONTEST_NOT_FOUND" };

  const category = await prisma.fotorankContestCategory.findFirst({
    where: { id: categoryId, contestId },
    select: { id: true, name: true },
  });
  if (!category) return { ok: false, code: "CATEGORY_NOT_FOUND" };

  const assignments = await prisma.fotorankJudgeAssignment.findMany({
    where: { contestId, categoryId },
    select: { id: true, methodType: true },
  });

  if (assignments.length === 0) {
    const entries = await prisma.fotorankContestEntry.findMany({
      where: { contestId, categoryId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, imageUrl: true },
    });
    const ranked = entries.map((e, i) => ({
      entryId: e.id,
      title: e.title,
      imageUrl: e.imageUrl,
      aggregateScore: null,
      voteCount: 0,
      rankPosition: i + 1,
    }));
    return {
      ok: true,
      variant: "NO_ASSIGNMENTS",
      message:
        "No hay asignaciones de jurado para esta categoría. El ranking consolidado requiere al menos una asignación (y un único método de evaluación entre todas).",
      ranked,
    };
  }

  const methodTypes = [...new Set(assignments.map((a) => a.methodType))];
  if (methodTypes.length > 1) {
    return {
      ok: false,
      code: "AMBIGUOUS_METHOD",
      methodTypesFound: methodTypes,
      message:
        "Hay más de un método de evaluación entre las asignaciones de esta categoría. Unificá el methodType de todas las asignaciones para obtener un ranking consolidado.",
    };
  }

  const methodType = methodTypes[0]! as FotorankJudgeMethodType;

  const entries = await prisma.fotorankContestEntry.findMany({
    where: { contestId, categoryId },
    select: { id: true, title: true, imageUrl: true },
  });

  const entryIds = entries.map((e) => e.id);
  const votes =
    entryIds.length === 0
      ? []
      : await prisma.fotorankJudgeVote.findMany({
          where: {
            entryId: { in: entryIds },
            assignmentId: { in: assignments.map((a) => a.id) },
          },
          select: {
            entryId: true,
            valueNumeric: true,
            valueBoolean: true,
            isFavorite: true,
            selectedRank: true,
            criteriaScoresJson: true,
          },
        });

  const votesByEntry = new Map<string, typeof votes>();
  for (const v of votes) {
    const list = votesByEntry.get(v.entryId) ?? [];
    list.push(v);
    votesByEntry.set(v.entryId, list);
  }

  const rows = entries.map((e) => {
    const list = votesByEntry.get(e.id) ?? [];
    const contributions: number[] = [];
    for (const v of list) {
      const s = extractScalarContribution(methodType, v);
      if (s !== null) contributions.push(s);
    }
    return {
      entryId: e.id,
      title: e.title,
      imageUrl: e.imageUrl,
      contributions,
    };
  });

  const ranked = rankEntriesForCategory(methodType, rows);

  return {
    ok: true,
    variant: "READY",
    methodType,
    aggregationLabel: humanizeAggregateLabel(methodType),
    sortHelp: sortExplanation(methodType),
    assignmentCount: assignments.length,
    ranked,
  };
}

export function decorateRankedRow(
  methodType: FotorankJudgeMethodType,
  row: RankedEntryResult,
): RankedEntryResult & { displayValue: string } {
  return {
    ...row,
    displayValue: formatAggregateDisplay(methodType, row.aggregateScore),
  };
}
