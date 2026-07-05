import type { ExifDeviceScanMode } from "@/lib/prisma";
import { randomUUID } from "crypto";
import {
  getBatchSizeForScanMode,
  isExifDeviceScanBackfillEnabled,
  isExifDeviceScanEnabled,
  isWithinExifDeviceScanWindow,
  getExifDeviceScanTimezone,
} from "@/lib/photographic-equipment/config";
import { runExifDeviceScanBatch } from "@/lib/photographic-equipment/process-exif-batch";
import {
  clearExifDeviceScanLockOnState,
  countPendingExifPhotos,
  recordExifDeviceScanBatch,
  setExifDeviceScanLockOnState,
  syncExifDeviceScanStatePending,
} from "@/lib/photographic-equipment/scan-state";
import {
  getExifDeviceScanLease,
  releaseExifDeviceScanLease,
  tryAcquireExifDeviceScanLease,
} from "@/lib/photographic-equipment/scan-lease";

const DEFAULT_LEASE_MS = 8 * 60 * 1000;

export type ExifDeviceScanSkippedReason =
  | "DISABLED"
  | "SKIPPED_OUTSIDE_WINDOW"
  | "LOCK_BUSY"
  | "BACKFILL_DISABLED"
  | "IDLE"
  | null;

export type ExifDeviceScanRunOptions = {
  /** Admin manual: ignora ventana horaria en modo DAILY */
  ignoreWindow?: boolean;
  /** Admin manual: ignora EXIF_DEVICE_SCAN_ENABLED */
  ignoreEnabledFlag?: boolean;
  /** Prefijo del holder del lease (cron, admin, etc.) */
  holderPrefix?: string;
  batchSizeOverride?: number;
};

export type ExifDeviceScanRunResult = {
  ok: boolean;
  skipped: boolean;
  skippedReason: ExifDeviceScanSkippedReason;
  mode: ExifDeviceScanMode;
  isBackfillComplete: boolean;
  backfillEnabled: boolean;
  processed: number;
  analyzed: number;
  noExif: number;
  failed: number;
  skippedExpired: number;
  pendingRemaining: number;
  lockStatus: "acquired" | "busy" | "not_needed";
  durationMs: number;
  batchSize: number;
  timezone: string;
  inWindow: boolean;
};

function buildSkippedResult(
  partial: Omit<
    ExifDeviceScanRunResult,
    "ok" | "skipped" | "processed" | "analyzed" | "noExif" | "failed" | "skippedExpired" | "durationMs" | "lockStatus"
  > & {
    skippedReason: Exclude<ExifDeviceScanSkippedReason, null>;
    durationMs?: number;
    lockStatus?: ExifDeviceScanRunResult["lockStatus"];
  }
): ExifDeviceScanRunResult {
  return {
    ok: true,
    skipped: true,
    processed: 0,
    analyzed: 0,
    noExif: 0,
    failed: 0,
    skippedExpired: 0,
    durationMs: partial.durationMs ?? 0,
    lockStatus: partial.lockStatus ?? "not_needed",
    ...partial,
  };
}

export async function runExifDeviceScanJob(
  options: ExifDeviceScanRunOptions = {}
): Promise<ExifDeviceScanRunResult> {
  const started = Date.now();
  const timezone = getExifDeviceScanTimezone();
  const inWindow = isWithinExifDeviceScanWindow();
  const backfillEnabled = isExifDeviceScanBackfillEnabled();

  if (!options.ignoreEnabledFlag && !isExifDeviceScanEnabled()) {
    const { state, pendingCount, effectiveMode } = await syncExifDeviceScanStatePending();
    return buildSkippedResult({
      skippedReason: "DISABLED",
      mode: effectiveMode,
      isBackfillComplete: state.isBackfillComplete,
      backfillEnabled,
      pendingRemaining: pendingCount,
      batchSize: getBatchSizeForScanMode(effectiveMode),
      timezone,
      inWindow,
      durationMs: Date.now() - started,
    });
  }

  const { state, pendingCount, effectiveMode } = await syncExifDeviceScanStatePending();
  const batchSize = options.batchSizeOverride ?? getBatchSizeForScanMode(effectiveMode);

  if (effectiveMode === "DAILY" && !options.ignoreWindow && !inWindow) {
    await recordExifDeviceScanBatch({
      processed: 0,
      analyzed: 0,
      noExif: 0,
      failed: 0,
      pendingRemaining: pendingCount,
    });
    return buildSkippedResult({
      skippedReason: "SKIPPED_OUTSIDE_WINDOW",
      mode: effectiveMode,
      isBackfillComplete: state.isBackfillComplete,
      backfillEnabled,
      pendingRemaining: pendingCount,
      batchSize,
      timezone,
      inWindow,
      durationMs: Date.now() - started,
    });
  }

  if (
    effectiveMode === "BACKFILL" &&
    !backfillEnabled &&
    !options.ignoreWindow &&
    !options.ignoreEnabledFlag
  ) {
    return buildSkippedResult({
      skippedReason: "BACKFILL_DISABLED",
      mode: effectiveMode,
      isBackfillComplete: state.isBackfillComplete,
      backfillEnabled,
      pendingRemaining: pendingCount,
      batchSize,
      timezone,
      inWindow,
      durationMs: Date.now() - started,
    });
  }

  const leaseHolder = `${options.holderPrefix ?? "scan"}:${randomUUID()}`;
  const acquired = await tryAcquireExifDeviceScanLease(leaseHolder, DEFAULT_LEASE_MS);
  if (!acquired) {
    const lease = await getExifDeviceScanLease();
    return buildSkippedResult({
      skippedReason: "LOCK_BUSY",
      mode: effectiveMode,
      isBackfillComplete: state.isBackfillComplete,
      backfillEnabled,
      pendingRemaining: pendingCount,
      batchSize,
      timezone,
      inWindow,
      lockStatus: "busy",
      durationMs: Date.now() - started,
    });
  }

  const lockExpiresAt = new Date(Date.now() + DEFAULT_LEASE_MS);
  await setExifDeviceScanLockOnState(leaseHolder, lockExpiresAt);

  try {
    const batchResult = await runExifDeviceScanBatch(batchSize);
    const pendingRemaining = await countPendingExifPhotos();
    const updatedState = await recordExifDeviceScanBatch({
      processed: batchResult.processed,
      analyzed: batchResult.withExif,
      noExif: batchResult.noExif,
      failed: batchResult.failed,
      pendingRemaining,
      lockHolder: leaseHolder,
      lockExpiresAt,
    });

    if (batchResult.processed === 0 && batchResult.skipped) {
      return buildSkippedResult({
        skippedReason: "IDLE",
        mode: updatedState.mode,
        isBackfillComplete: updatedState.isBackfillComplete,
        backfillEnabled,
        pendingRemaining,
        batchSize,
        timezone,
        inWindow,
        lockStatus: "acquired",
        durationMs: Date.now() - started,
      });
    }

    return {
      ok: true,
      skipped: false,
      skippedReason: null,
      mode: updatedState.mode,
      isBackfillComplete: updatedState.isBackfillComplete,
      backfillEnabled,
      processed: batchResult.processed,
      analyzed: batchResult.withExif,
      noExif: batchResult.noExif,
      failed: batchResult.failed,
      skippedExpired: batchResult.skippedExpired,
      pendingRemaining,
      lockStatus: "acquired",
      durationMs: Date.now() - started,
      batchSize,
      timezone,
      inWindow,
    };
  } finally {
    await releaseExifDeviceScanLease(leaseHolder);
    await clearExifDeviceScanLockOnState();
  }
}

export type ExifDeviceScanMultiRunResult = {
  ok: boolean;
  batchesRun: number;
  totals: {
    processed: number;
    analyzed: number;
    noExif: number;
    failed: number;
  };
  pendingRemaining: number;
  mode: ExifDeviceScanMode;
  isBackfillComplete: boolean;
  durationMs: number;
  messages: string[];
};

export async function runExifDeviceScanMultiBatch(
  maxBatches: number,
  options: ExifDeviceScanRunOptions = {}
): Promise<ExifDeviceScanMultiRunResult> {
  const started = Date.now();
  const messages: string[] = [];
  let batchesRun = 0;
  let processed = 0;
  let analyzed = 0;
  let noExif = 0;
  let failed = 0;
  let lastResult: ExifDeviceScanRunResult | null = null;

  for (let i = 0; i < maxBatches; i += 1) {
    const result = await runExifDeviceScanJob({
      ...options,
      holderPrefix: options.holderPrefix ?? "admin-multi",
    });
    lastResult = result;

    if (result.skipped && result.skippedReason !== "IDLE") {
      messages.push(result.skippedReason ?? "skipped");
      break;
    }

    if (result.processed === 0) break;

    batchesRun += 1;
    processed += result.processed;
    analyzed += result.analyzed;
    noExif += result.noExif;
    failed += result.failed;
    messages.push(
      `Lote ${batchesRun}: ${result.processed} fotos (${result.analyzed} analizadas, ${result.pendingRemaining} pendientes)`
    );
  }

  return {
    ok: true,
    batchesRun,
    totals: { processed, analyzed, noExif, failed },
    pendingRemaining: lastResult?.pendingRemaining ?? (await countPendingExifPhotos()),
    mode: lastResult?.mode ?? "BACKFILL",
    isBackfillComplete: lastResult?.isBackfillComplete ?? false,
    durationMs: Date.now() - started,
    messages,
  };
}
