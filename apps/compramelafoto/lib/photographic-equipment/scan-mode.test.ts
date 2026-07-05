import { describe, expect, it } from "vitest";
import type { ExifDeviceScanState } from "@/lib/prisma";
import { resolveEffectiveScanMode } from "./scan-mode";
import { isWithinExifDeviceScanWindow } from "./config";

function mockState(
  partial: Partial<ExifDeviceScanState> & Pick<ExifDeviceScanState, "isBackfillComplete" | "mode">
): ExifDeviceScanState {
  return {
    id: 1,
    lastRunAt: null,
    lastCompletedAt: null,
    lastBatchAt: null,
    lastBatchProcessed: 0,
    lastBatchAnalyzed: 0,
    pendingCount: 0,
    processedTotal: 0,
    failedTotal: 0,
    noExifTotal: 0,
    analyzedTotal: 0,
    currentLockId: null,
    lockExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("resolveEffectiveScanMode", () => {
  it("usa BACKFILL mientras hay pendientes y el backfill no terminó", () => {
    const mode = resolveEffectiveScanMode(
      mockState({ mode: "BACKFILL", isBackfillComplete: false }),
      1200
    );
    expect(mode).toBe("BACKFILL");
  });

  it("pasa a DAILY cuando pendingCount es 0", () => {
    const mode = resolveEffectiveScanMode(
      mockState({ mode: "BACKFILL", isBackfillComplete: false }),
      0
    );
    expect(mode).toBe("DAILY");
  });

  it("permanece en DAILY tras completar backfill aunque haya nuevas pendientes", () => {
    const mode = resolveEffectiveScanMode(
      mockState({ mode: "DAILY", isBackfillComplete: true }),
      50
    );
    expect(mode).toBe("DAILY");
  });
});

describe("isWithinExifDeviceScanWindow", () => {
  it("detecta ventana 02:00–05:00 AR (UTC-3)", () => {
    const inside = new Date("2026-07-02T06:30:00.000Z");
    const outside = new Date("2026-07-02T12:00:00.000Z");
    expect(isWithinExifDeviceScanWindow(inside)).toBe(true);
    expect(isWithinExifDeviceScanWindow(outside)).toBe(false);
  });
});
