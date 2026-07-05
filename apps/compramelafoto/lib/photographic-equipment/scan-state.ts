import type { ExifDeviceScanMode, ExifDeviceScanState } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  isExifDeviceScanBackfillEnabled,
  isWithinExifDeviceScanWindow,
} from "@/lib/photographic-equipment/config";
import { resolveEffectiveScanMode } from "@/lib/photographic-equipment/scan-mode";
import { pendingExifPhotoWhere } from "@/lib/photographic-equipment/pending-photos";

export { resolveEffectiveScanMode };

const STATE_ROW_ID = 1;

export type ExifDeviceScanStateSnapshot = {
  mode: ExifDeviceScanMode;
  isBackfillComplete: boolean;
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  lastBatchAt: string | null;
  lastBatchProcessed: number;
  lastBatchAnalyzed: number;
  pendingCount: number;
  processedTotal: number;
  failedTotal: number;
  noExifTotal: number;
  analyzedTotal: number;
  currentLockId: string | null;
  lockExpiresAt: string | null;
  backfillEnabled: boolean;
  inWindow: boolean;
};

export function toScanStateSnapshot(
  state: ExifDeviceScanState,
  pendingCount: number
): ExifDeviceScanStateSnapshot {
  return {
    mode: state.mode,
    isBackfillComplete: state.isBackfillComplete,
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    lastCompletedAt: state.lastCompletedAt?.toISOString() ?? null,
    lastBatchAt: state.lastBatchAt?.toISOString() ?? null,
    lastBatchProcessed: state.lastBatchProcessed,
    lastBatchAnalyzed: state.lastBatchAnalyzed,
    pendingCount,
    processedTotal: state.processedTotal,
    failedTotal: state.failedTotal,
    noExifTotal: state.noExifTotal,
    analyzedTotal: state.analyzedTotal,
    currentLockId: state.currentLockId,
    lockExpiresAt: state.lockExpiresAt?.toISOString() ?? null,
    backfillEnabled: isExifDeviceScanBackfillEnabled(),
    inWindow: isWithinExifDeviceScanWindow(),
  };
}

export async function countPendingExifPhotos(): Promise<number> {
  return prisma.photo.count({ where: pendingExifPhotoWhere });
}

export async function getOrCreateExifDeviceScanState(): Promise<ExifDeviceScanState> {
  const existing = await prisma.exifDeviceScanState.findUnique({ where: { id: STATE_ROW_ID } });
  if (existing) return existing;

  const pendingCount = await countPendingExifPhotos();
  const isComplete = pendingCount === 0;

  return prisma.exifDeviceScanState.create({
    data: {
      id: STATE_ROW_ID,
      mode: isComplete ? "DAILY" : "BACKFILL",
      isBackfillComplete: isComplete,
      pendingCount,
      lastCompletedAt: isComplete ? new Date() : null,
    },
  });
}

export async function syncExifDeviceScanStatePending(): Promise<{
  state: ExifDeviceScanState;
  pendingCount: number;
  effectiveMode: ExifDeviceScanMode;
}> {
  const pendingCount = await countPendingExifPhotos();
  const state = await getOrCreateExifDeviceScanState();
  const effectiveMode = resolveEffectiveScanMode(state, pendingCount);

  const shouldCompleteBackfill = pendingCount === 0 && !state.isBackfillComplete;
  const shouldRevertMode =
    effectiveMode === "DAILY" && state.mode === "BACKFILL" && pendingCount === 0;

  if (state.pendingCount !== pendingCount || shouldCompleteBackfill || shouldRevertMode) {
    const updated = await prisma.exifDeviceScanState.update({
      where: { id: STATE_ROW_ID },
      data: {
        pendingCount,
        ...(shouldCompleteBackfill || shouldRevertMode
          ? {
              mode: "DAILY" as const,
              isBackfillComplete: true,
              lastCompletedAt: state.lastCompletedAt ?? new Date(),
            }
          : {}),
        ...(pendingCount > 0 && !state.isBackfillComplete ? { mode: "BACKFILL" as const } : {}),
      },
    });
    return { state: updated, pendingCount, effectiveMode: resolveEffectiveScanMode(updated, pendingCount) };
  }

  return { state, pendingCount, effectiveMode };
}

export type RecordScanBatchInput = {
  processed: number;
  analyzed: number;
  noExif: number;
  failed: number;
  pendingRemaining: number;
  lockHolder?: string | null;
  lockExpiresAt?: Date | null;
};

export async function recordExifDeviceScanBatch(input: RecordScanBatchInput): Promise<ExifDeviceScanState> {
  const now = new Date();
  const state = await getOrCreateExifDeviceScanState();
  const backfillJustCompleted =
    !state.isBackfillComplete && input.pendingRemaining === 0 && isExifDeviceScanBackfillEnabled();

  return prisma.exifDeviceScanState.update({
    where: { id: STATE_ROW_ID },
    data: {
      lastRunAt: now,
      pendingCount: input.pendingRemaining,
      processedTotal: { increment: input.processed },
      analyzedTotal: { increment: input.analyzed },
      noExifTotal: { increment: input.noExif },
      failedTotal: { increment: input.failed },
      ...(input.processed > 0
        ? {
            lastBatchAt: now,
            lastBatchProcessed: input.processed,
            lastBatchAnalyzed: input.analyzed,
          }
        : {}),
      ...(backfillJustCompleted
        ? {
            mode: "DAILY",
            isBackfillComplete: true,
            lastCompletedAt: now,
          }
        : {}),
      currentLockId: input.lockHolder ?? null,
      lockExpiresAt: input.lockExpiresAt ?? null,
    },
  });
}

export async function setExifDeviceScanLockOnState(
  holder: string,
  expiresAt: Date
): Promise<void> {
  await prisma.exifDeviceScanState.update({
    where: { id: STATE_ROW_ID },
    data: {
      currentLockId: holder,
      lockExpiresAt: expiresAt,
    },
  });
}

export async function clearExifDeviceScanLockOnState(): Promise<void> {
  await prisma.exifDeviceScanState.update({
    where: { id: STATE_ROW_ID },
    data: {
      currentLockId: null,
      lockExpiresAt: null,
    },
  });
}

export async function getExifDeviceScanStateSnapshot(): Promise<ExifDeviceScanStateSnapshot> {
  const { state, pendingCount } = await syncExifDeviceScanStatePending();
  return toScanStateSnapshot(state, pendingCount);
}
