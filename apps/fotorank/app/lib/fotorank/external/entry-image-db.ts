/**
 * Lectura en la base de lo que necesita `entry-image-service.ts`: la obra, el ORIGINAL de su
 * versión activa (`activeAssetId`) y el JURY_PREVIEW derivado de ese original.
 */
import { prisma } from "@repo/db";

import type { EntryImageRecord } from "./entry-image-service";

export async function loadEntryImageRecord(entryId: string): Promise<EntryImageRecord | null> {
  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      entryNumber: true,
      status: true,
      withdrawnAt: true,
      activeAsset: {
        select: { id: true, kind: true, storageKey: true, mimeType: true, extension: true, sourceOriginalAssetId: true },
      },
    },
  });
  if (!entry) return null;

  // `activeAssetId` apunta al ORIGINAL; si alguna vez apuntara a un derivado, se sube a su original.
  let original = entry.activeAsset?.kind === "ORIGINAL" ? entry.activeAsset : null;
  if (!original && entry.activeAsset?.sourceOriginalAssetId) {
    original = await prisma.fotorankContestEntryAsset.findFirst({
      where: { id: entry.activeAsset.sourceOriginalAssetId, entryId: entry.id, kind: "ORIGINAL" },
      select: { id: true, kind: true, storageKey: true, mimeType: true, extension: true, sourceOriginalAssetId: true },
    });
  }

  const juryPreview = original
    ? await prisma.fotorankContestEntryAsset.findFirst({
        where: { entryId: entry.id, kind: "JURY_PREVIEW", sourceOriginalAssetId: original.id },
        orderBy: { createdAt: "desc" },
        select: { storageKey: true },
      })
    : null;

  return {
    entryId: entry.id,
    entryNumber: entry.entryNumber,
    status: entry.status,
    withdrawnAt: entry.withdrawnAt,
    original: original
      ? { storageKey: original.storageKey, mimeType: original.mimeType, extension: original.extension }
      : null,
    juryPreview: juryPreview ? { storageKey: juryPreview.storageKey } : null,
  };
}
