/**
 * J-P1-08 — Dominio de `FotorankContestEntry` (obras evaluables en FotoRank).
 *
 * ## Qué representa
 * Una **obra** (foto + metadatos opcionales) anclada a un **FotorankContest** y una **FotorankContestCategory**.
 * Es el destino de `FotorankJudgeVote.entryId`: el módulo Jurados solo consume esta tabla para el listado y el voto.
 *
 * ## Frontera con legacy
 * El modelo `Entry` bajo `Contest` / `Workspace` (suite ComprameLaFoto) es **otro producto**. No hay sincronización automática.
 * Para que un jurado FotoRank evalúe, la obra debe existir como `FotorankContestEntry`. Punto.
 *
 * ## Invariantes (integridad referencial ya las refuerza Prisma)
 * - `contestId` + `categoryId` deben corresponder a una categoría de ese concurso (FK).
 * - `imageUrl` no vacío para considerarse **evaluable** en UI/panel jurado.
 *
 * ## Cuándo se crea (pipeline actual)
 * - Acción server `createFotorankContestEntry` (dashboard, org activa): carga operativa / pruebas hasta existir inscripción pública.
 * - Futuro: flujo de inscripción del participante debe crear la misma entidad (o delegar en esta acción).
 */

import { prisma } from "@repo/db";

export type FotorankContestEntryRow = {
  id: string;
  contestId: string;
  categoryId: string;
  imageUrl: string;
  title?: string | null;
  description?: string | null;
  authorUserId?: number | null;
};

/** Códigos de diagnóstico para preparación de categoría a juicio. */
export type CategoryJudgingReadinessIssueCode =
  | "NO_ENTRIES"
  | "NO_EVALUABLE_ENTRIES";

export type CategoryJudgingReadiness = {
  contestId: string;
  categoryId: string;
  totalEntries: number;
  evaluableEntryCount: number;
  /** Al menos una entry evaluable: la categoría tiene material para el panel jurado. */
  readyForJudgingPanel: boolean;
  issues: Array<{ code: CategoryJudgingReadinessIssueCode; message: string }>;
};

/**
 * Reglas mínimas para que una fila se considere evaluable por jurados (listado + voto).
 * No incluye estado de concurso ni ventana de asignación (eso es `getJudgeEvaluationEligibility`).
 */
export function isEvaluableFotorankContestEntry(row: Pick<FotorankContestEntryRow, "imageUrl" | "contestId" | "categoryId">): boolean {
  const url = row.imageUrl?.trim() ?? "";
  if (!url) return false;
  if (!row.contestId?.trim() || !row.categoryId?.trim()) return false;
  return true;
}

export function filterFotorankEntriesEvaluableForJudging<T extends FotorankContestEntryRow>(rows: T[]): T[] {
  return rows.filter((r) => isEvaluableFotorankContestEntry(r));
}

/**
 * Indica si una categoría tiene al menos una obra lista para mostrar/votar en el módulo jurado.
 */
export async function getCategoryJudgingReadiness(
  contestId: string,
  categoryId: string
): Promise<CategoryJudgingReadiness> {
  const rows = await prisma.fotorankContestEntry.findMany({
    where: { contestId, categoryId },
    select: { id: true, contestId: true, categoryId: true, imageUrl: true },
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
      message: "Hay registros de obra pero ninguno tiene imagen válida para evaluar.",
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

/**
 * Readiness agregado por concurso (todas las categorías del concurso).
 */
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
  const anyCategoryReady = list.some((x) => x.readyForJudgingPanel);
  return { contestId, categories: list, anyCategoryReady };
}
