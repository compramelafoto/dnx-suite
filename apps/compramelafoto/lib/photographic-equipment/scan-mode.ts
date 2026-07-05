import type { ExifDeviceScanMode, ExifDeviceScanState } from "@/lib/prisma";

export function resolveEffectiveScanMode(
  state: Pick<ExifDeviceScanState, "isBackfillComplete" | "mode">,
  pendingCount: number
): ExifDeviceScanMode {
  if (state.isBackfillComplete) return "DAILY";
  if (pendingCount === 0) return "DAILY";
  return "BACKFILL";
}
