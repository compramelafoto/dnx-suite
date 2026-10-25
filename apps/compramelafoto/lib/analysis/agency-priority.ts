import { prisma } from "@/lib/prisma";

/**
 * En temporada un álbum de agencia recibe miles de fotos por día y el turista se va de la playa:
 * se le reserva hasta la mitad de cada lote. La otra mitad sigue en orden de llegada para todos.
 */
export function agencyPriorityQuota(batchSize: number): number {
  return batchSize > 1 ? Math.min(Math.ceil(batchSize / 2), batchSize - 1) : 0;
}

export async function claimAgencyPriorityJobs(
  now: Date,
  limit: number,
  ageCutoff: Date | null
): Promise<Array<{ id: number; photoId: number }>> {
  if (limit <= 0) return [];
  // Sin tope de antigüedad, el cutoff "en el pasado lejano" deja pasar todo.
  const cutoff = ageCutoff ?? new Date(0);
  return prisma.$queryRaw<Array<{ id: number; photoId: number }>>`
    WITH claimed AS (
      SELECT j.id
      FROM "PhotoAnalysisJob" j
      INNER JOIN "Photo" p ON p.id = j."photoId"
      INNER JOIN "AgencyAlbum" aa ON aa."albumId" = p."albumId"
      WHERE j.status = 'PENDING'
        AND (j."runAfter" IS NULL OR j."runAfter" <= ${now})
        AND p."isRemoved" = false
        AND (p."createdAt" >= ${cutoff} OR j."infraFailureAt" IS NOT NULL)
      ORDER BY j."createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF j SKIP LOCKED
    )
    UPDATE "PhotoAnalysisJob"
    SET status = 'PROCESSING', "lockedAt" = ${now}
    WHERE id IN (SELECT id FROM claimed)
    RETURNING id, "photoId"
  `;
}

type ClaimedRows = Array<{ id: number; photoId: number }>;

/**
 * Toma primero los trabajos de agencia y completa el lote con el orden de llegada.
 * - Si falla la prioridad, se sigue sólo con el orden de llegada (lote completo).
 * - Si falla el orden de llegada pero ya hay trabajos de agencia tomados (quedaron en PROCESSING),
 *   se devuelven igual para que se procesen y no queden trabados.
 * - Sin trabajos de agencia, un error del orden de llegada se propaga como siempre.
 */
export async function combineClaims(args: {
  batchSize: number;
  claimPriority: () => Promise<ClaimedRows>;
  claimFifo: (remaining: number) => Promise<ClaimedRows>;
}): Promise<{ priority: ClaimedRows; locked: ClaimedRows }> {
  let priority: ClaimedRows = [];
  try {
    priority = await args.claimPriority();
  } catch (err) {
    console.warn("[analysis] prioridad de agencia falló", err);
    priority = [];
  }
  const remaining = args.batchSize - priority.length;
  if (remaining <= 0) return { priority, locked: priority };
  if (priority.length === 0) {
    return { priority, locked: await args.claimFifo(remaining) };
  }
  try {
    const fifo = await args.claimFifo(remaining);
    return { priority, locked: [...priority, ...fifo] };
  } catch (err) {
    console.warn("[analysis] toma por orden de llegada falló tras la prioridad de agencia", err);
    return { priority, locked: priority };
  }
}
