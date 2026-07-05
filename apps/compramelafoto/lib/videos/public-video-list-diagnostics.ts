import type { VideoProcessingStatus } from "@/lib/prisma";

export type PublicVideoRowForDiagnostics = {
  id: number;
  processingStatus: VideoProcessingStatus | string;
  isRemoved: boolean;
  sellEnabled: boolean;
  expiresAt: Date;
  previewKey: string | null;
  thumbnailKey: string | null;
};

export type PublicVideoListDiagnostics = {
  scope: "album" | "event";
  scopeId: number;
  applyExpiresFilter: boolean;
  total: number;
  returned: number;
  byStatus: Record<string, number>;
  removed: number;
  sellDisabled: number;
  expired: number;
  missingPreviewKey: number;
  missingThumbnailKey: number;
  eligibleReadyNotRemoved: number;
  excludedFromResponse: Array<{
    id: number;
    reasons: string[];
    processingStatus: string;
    isRemoved: boolean;
    sellEnabled: boolean;
    expired: boolean;
    missingPreviewKey: boolean;
    missingThumbnailKey: boolean;
  }>;
  /** Solo eventos: álbumes considerados / excluidos de la grilla. */
  eventAlbums?: {
    total: number;
    eligible: number;
    excluded: number;
    excludedAlbumIds?: number[];
  };
};

const STATUS_KEYS = ["UPLOADED", "PROCESSING", "READY", "FAILED", "EXPIRED", "PENDING"] as const;

function emptyStatusCounts(): Record<string, number> {
  return Object.fromEntries(STATUS_KEYS.map((s) => [s, 0]));
}

export function buildPublicVideoListDiagnostics(
  rows: PublicVideoRowForDiagnostics[],
  returnedIds: Set<number>,
  options: {
    scope: "album" | "event";
    scopeId: number;
    applyExpiresFilter: boolean;
    eventAlbums?: PublicVideoListDiagnostics["eventAlbums"];
  }
): PublicVideoListDiagnostics {
  const now = new Date();
  const byStatus = emptyStatusCounts();
  let removed = 0;
  let sellDisabled = 0;
  let expired = 0;
  let missingPreviewKey = 0;
  let missingThumbnailKey = 0;
  let eligibleReadyNotRemoved = 0;

  for (const v of rows) {
    const status = String(v.processingStatus);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (v.isRemoved) removed++;
    if (!v.sellEnabled) sellDisabled++;
    if (v.expiresAt < now) expired++;
    if (!v.previewKey?.trim()) missingPreviewKey++;
    if (!v.thumbnailKey?.trim()) missingThumbnailKey++;
    if (!v.isRemoved && status === "READY") eligibleReadyNotRemoved++;
  }

  const excludedFromResponse = rows
    .filter((v) => !returnedIds.has(v.id))
    .map((v) => {
      const status = String(v.processingStatus);
      const isExpired = v.expiresAt < now;
      const reasons: string[] = [];
      if (v.isRemoved) reasons.push("isRemoved");
      if (status !== "READY") reasons.push(`status:${status}`);
      if (options.applyExpiresFilter && isExpired) reasons.push("expiresAt");
      return {
        id: v.id,
        reasons,
        processingStatus: status,
        isRemoved: v.isRemoved,
        sellEnabled: v.sellEnabled,
        expired: isExpired,
        missingPreviewKey: !v.previewKey?.trim(),
        missingThumbnailKey: !v.thumbnailKey?.trim(),
      };
    });

  const diagnostics: PublicVideoListDiagnostics = {
    scope: options.scope,
    scopeId: options.scopeId,
    applyExpiresFilter: options.applyExpiresFilter,
    total: rows.length,
    returned: returnedIds.size,
    byStatus,
    removed,
    sellDisabled,
    expired,
    missingPreviewKey,
    missingThumbnailKey,
    eligibleReadyNotRemoved,
    excludedFromResponse,
  };

  if (options.eventAlbums) {
    diagnostics.eventAlbums = options.eventAlbums;
  }

  return diagnostics;
}

export function logPublicVideoListDiagnostics(diagnostics: PublicVideoListDiagnostics): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[public-videos] list diagnostics", diagnostics);
}

export function devDiagnosticsPayload(
  diagnostics: PublicVideoListDiagnostics
): PublicVideoListDiagnostics | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  return diagnostics;
}
