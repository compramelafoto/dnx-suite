import type { PrismaClient } from "@/lib/prisma";

export type ClaimedCameraIngestJob = {
  id: string;
  userId: number;
  albumId: number;
  rawKey: string;
  attempts: number;
  uploadLogId: number | null;
  eventFolderId: number | null;
  folderId: number | null;
};

/**
 * Toma un job PENDING con lock atómico (FOR UPDATE SKIP LOCKED).
 * Incrementa attempts y marca PROCESSING.
 */
export async function claimNextCameraIngestJob(
  prisma: PrismaClient
): Promise<ClaimedCameraIngestJob | null> {
  const now = new Date();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: number;
      albumId: number;
      rawKey: string;
      attempts: number;
      uploadLogId: number | null;
      eventFolderId: number | null;
      folderId: number | null;
    }>
  >`
    WITH next_job AS (
      SELECT id
      FROM "CameraIngestJob"
      WHERE status = 'PENDING'
        AND ("runAfter" IS NULL OR "runAfter" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "CameraIngestJob" AS j
    SET
      status = 'PROCESSING',
      "lockedAt" = ${now},
      attempts = j.attempts + 1,
      "updatedAt" = ${now}
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.id, j."userId", j."albumId", j."rawKey", j.attempts, j."uploadLogId", j."eventFolderId", j."folderId"
  `;

  return rows[0] ?? null;
}
